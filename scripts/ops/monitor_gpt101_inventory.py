#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


BASE_DIR = Path(__file__).resolve().parent
NOTIFY_SCRIPT = BASE_DIR / "feishu_urgent_notify.cjs"
STATE_DIR = BASE_DIR / "state"
LATEST_PATH = STATE_DIR / "gpt101_inventory_latest.json"
ALERT_STATE_PATH = STATE_DIR / "gpt101_inventory_alert_state.json"
LOG_PATH = BASE_DIR / "logs" / "gpt101_inventory_monitor.log"

DEFAULT_BASE_URL = "https://gpt101.org"
DEFAULT_RECIPIENT_OPEN_ID = "ou_171c5540e846b6eb8b69beaaa0cb738e"
TIMEZONE = "Asia/Shanghai"


class MonitorError(RuntimeError):
    pass


def now_local() -> datetime:
    return datetime.now(ZoneInfo(TIMEZONE))


def getenv_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MonitorError(f"missing required env: {name}")
    return value


def getenv_float(name: str, default: float) -> float:
    value = os.environ.get(name, "").strip()
    if not value:
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise MonitorError(f"invalid float env {name}: {value}") from exc


def append_log(entry: dict[str, Any]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def write_latest(entry: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    LATEST_PATH.write_text(
        json.dumps(entry, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def read_json_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def write_json_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def alert_allowed(kind: str, fingerprint: str, now: datetime) -> tuple[bool, str]:
    cooldown_minutes = getenv_float("GPT101_INVENTORY_ALERT_COOLDOWN_MINUTES", 120.0)
    state = read_json_file(ALERT_STATE_PATH)
    item = state.get(kind) if isinstance(state.get(kind), dict) else {}
    last_fingerprint = str(item.get("fingerprint") or "")
    last_sent_at = str(item.get("sentAt") or "")

    if last_fingerprint == fingerprint and last_sent_at:
        try:
            elapsed = (now - datetime.fromisoformat(last_sent_at)).total_seconds() / 60
        except ValueError:
            elapsed = cooldown_minutes + 1
        if elapsed < cooldown_minutes:
            return False, f"cooldown active ({elapsed:.1f}/{cooldown_minutes:g} minutes)"

    return True, ""


def mark_alert_sent(kind: str, fingerprint: str, now: datetime) -> None:
    state = read_json_file(ALERT_STATE_PATH)
    state[kind] = {
        "fingerprint": fingerprint,
        "sentAt": now.isoformat(),
    }
    write_json_file(ALERT_STATE_PATH, state)


def build_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request_json(
    opener: urllib.request.OpenerDirector,
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    *,
    timeout: int = 30,
    sensitive: bool = False,
) -> dict[str, Any]:
    data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "gpt101-inventory-monitor/1.0",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        message = f"HTTP {exc.code}"
        try:
            parsed = json.loads(raw) if raw else {}
            message = parsed.get("message") or parsed.get("code") or message
        except json.JSONDecodeError:
            if raw and not sensitive:
                message = f"{message}: {raw[:300]}"
        raise MonitorError(message) from exc
    except urllib.error.URLError as exc:
        raise MonitorError(f"network error: {exc.reason}") from exc

    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        if sensitive:
            raise MonitorError("invalid JSON response") from exc
        raise MonitorError(f"invalid JSON response: {raw[:300]}") from exc


def fetch_channels() -> list[dict[str, Any]]:
    base_url = os.environ.get("GPT101_MONITOR_BASE_URL", DEFAULT_BASE_URL).strip().rstrip("/")
    email = getenv_required("GPT101_MONITOR_EMAIL")
    password = getenv_required("GPT101_MONITOR_PASSWORD")

    opener = build_opener()
    request_json(
        opener,
        "POST",
        f"{base_url}/api/auth/sign-in/email",
        {
            "email": email,
            "password": password,
            "callbackURL": "/admin/upgrade-channels",
        },
        sensitive=True,
    )

    payload = request_json(
        opener,
        "GET",
        f"{base_url}/api/admin/upgrade-channels/list",
    )
    if payload.get("code") != 0:
        raise MonitorError(str(payload.get("message") or "inventory API returned non-zero code"))

    data = payload.get("data")
    if not isinstance(data, list):
        raise MonitorError("inventory API returned invalid data")
    return [row for row in data if isinstance(row, dict)]


def normalize_channels(channels: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for ch in channels:
        available = ch.get("availableCount", 0)
        try:
            available_count = int(available or 0)
        except (TypeError, ValueError):
            available_count = 0
        normalized.append(
            {
                "id": ch.get("id"),
                "code": ch.get("code"),
                "name": ch.get("name"),
                "status": ch.get("status"),
                "requiresCardkey": bool(ch.get("requiresCardkey")),
                "availableCount": available_count,
            }
        )
    return normalized


def monitored_channels(channels: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        ch
        for ch in channels
        if ch.get("status") == "active" and bool(ch.get("requiresCardkey"))
    ]


def format_channels(channels: list[dict[str, Any]]) -> str:
    if not channels:
        return "- 无"
    return "\n".join(
        f"- {ch.get('name') or ch.get('code')}: {ch.get('availableCount', 0)}"
        for ch in channels
    )


def send_notification(
    title: str,
    body: str,
    *,
    app_urgent: bool = False,
    phone_urgent: bool = False,
) -> dict[str, Any]:
    recipient_open_id = os.environ.get(
        "GPT101_MONITOR_RECIPIENT_OPEN_ID",
        DEFAULT_RECIPIENT_OPEN_ID,
    ).strip()
    if not recipient_open_id:
        raise MonitorError("missing recipient open id")

    cmd = [
        "node",
        str(NOTIFY_SCRIPT),
        "--account-id",
        "xiaohe",
        "--recipient-open-id",
        recipient_open_id,
        "--title",
        title,
        "--body",
        body,
    ]
    if app_urgent:
        cmd.append("--app-urgent")
    if phone_urgent:
        cmd.append("--phone-urgent")

    proc = subprocess.run(
        cmd,
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        raise MonitorError((proc.stderr or proc.stdout or "feishu notify failed").strip())

    stdout = (proc.stdout or "").strip()
    if not stdout:
        return {}
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"unparsed_stdout": stdout[-1000:]}


def build_inventory_entry(mode: str) -> dict[str, Any]:
    now = now_local()
    total_threshold = getenv_float("GPT101_INVENTORY_TOTAL_THRESHOLD", 20.0)
    channel_threshold = getenv_float("GPT101_INVENTORY_CHANNEL_THRESHOLD", -1.0)

    channels = normalize_channels(fetch_channels())
    monitored = monitored_channels(channels)
    total_available = sum(int(ch.get("availableCount", 0)) for ch in monitored)
    low_channels = [
        ch
        for ch in monitored
        if int(ch.get("availableCount", 0)) <= channel_threshold
    ]

    return {
        "timestamp": now.isoformat(),
        "mode": mode,
        "thresholds": {
            "total": total_threshold,
            "channel": channel_threshold,
        },
        "totalAvailable": total_available,
        "monitoredChannelCount": len(monitored),
        "lowChannelCount": len(low_channels),
        "channels": monitored,
        "lowChannels": low_channels,
    }


def run_check() -> int:
    try:
        entry = build_inventory_entry("check")
        write_latest(entry)

        now = datetime.fromisoformat(entry["timestamp"])
        total_threshold = float(entry["thresholds"]["total"])
        low_channels = entry["lowChannels"]
        total_available = int(entry["totalAvailable"])
        should_alert = total_available < total_threshold or bool(low_channels)

        if should_alert:
            reasons = []
            if total_available < total_threshold:
                reasons.append(f"总可用库存 {total_available} 低于阈值 {total_threshold:g}")
            if low_channels:
                reasons.append(f"{len(low_channels)} 个渠道达到或低于单渠道阈值")

            body = (
                "GPT101 上游渠道卡密库存需要关注。\n\n"
                + "触发原因：\n"
                + "\n".join(f"- {reason}" for reason in reasons)
                + "\n\n当前监控渠道：\n"
                + format_channels(entry["channels"])
                + "\n\n低库存渠道：\n"
                + format_channels(low_channels)
            )
            fingerprint = json.dumps(
                {
                    "totalBelow": total_available < total_threshold,
                    "totalAvailable": total_available,
                    "lowChannels": sorted(str(ch.get("code") or ch.get("id")) for ch in low_channels),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            allowed, reason = alert_allowed("low_inventory", fingerprint, now)
            if allowed:
                entry["notification"] = send_notification(
                    "GPT101 上游渠道卡密库存不足",
                    body,
                    app_urgent=True,
                    phone_urgent=total_available < total_threshold,
                )
                mark_alert_sent("low_inventory", fingerprint, now)
            else:
                entry["notificationSuppressed"] = reason

        append_log(entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 1 if should_alert else 0
    except Exception as exc:
        now = now_local()
        entry = {
            "timestamp": now.isoformat(),
            "mode": "check",
            "ok": False,
            "error": str(exc),
        }
        try:
            fingerprint = str(exc)[:500]
            allowed, reason = alert_allowed("monitor_failure", fingerprint, now)
            if allowed:
                entry["notification"] = send_notification(
                    "GPT101 库存监控失败",
                    f"GPT101 库存监控执行失败：\n\n{str(exc)[:1200]}",
                    app_urgent=True,
                    phone_urgent=False,
                )
                mark_alert_sent("monitor_failure", fingerprint, now)
            else:
                entry["notificationSuppressed"] = reason
        except Exception as notify_exc:
            entry["notificationError"] = str(notify_exc)
        append_log(entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 1


def run_daily() -> int:
    try:
        entry = build_inventory_entry("daily")
        write_latest(entry)
        body = (
            f"检测时间：{entry['timestamp']}\n"
            f"总可用库存：{entry['totalAvailable']}\n"
            f"监控渠道数：{entry['monitoredChannelCount']}\n\n"
            + format_channels(entry["channels"])
        )
        entry["notification"] = send_notification(
            "GPT101 上游渠道卡密库存日报",
            body,
            app_urgent=False,
            phone_urgent=False,
        )
        append_log(entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 0
    except Exception as exc:
        entry = {
            "timestamp": now_local().isoformat(),
            "mode": "daily",
            "ok": False,
            "error": str(exc),
        }
        append_log(entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Monitor GPT101 channel cardkey inventory.")
    parser.add_argument("--mode", choices=["check", "daily"], required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.mode == "check":
        return run_check()
    return run_daily()


if __name__ == "__main__":
    raise SystemExit(main())
