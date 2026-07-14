#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BASE_DIR="/home/work/.openclaw/workspace-xiaohe/projects/apipool-ops"
LOG_DIR="/home/work/.openclaw/logs/gpt101-monitor"
LOCK_DIR="/home/work/.openclaw/locks"
PYTHON="$BASE_DIR/.venv/bin/python"
RUN_WITH_ENV="$BASE_DIR/run_with_env.sh"

mkdir -p "$LOG_DIR" "$LOCK_DIR"
export PATH="/home/work/.nvm/versions/node/v22.22.0/bin:/home/work/.local/bin:/usr/local/bin:/usr/bin:/bin"

job="${1:-}"
case "$job" in
  inventory-check)
    lock_file="$LOCK_DIR/gpt101-inventory-check.lock"
    log_file="$LOG_DIR/inventory-check.log"
    cmd=("$RUN_WITH_ENV" "$PYTHON" "$BASE_DIR/monitor_gpt101_inventory.py" --mode check)
    ;;
  inventory-daily)
    lock_file="$LOCK_DIR/gpt101-inventory-daily.lock"
    log_file="$LOG_DIR/inventory-daily.log"
    cmd=("$RUN_WITH_ENV" "$PYTHON" "$BASE_DIR/monitor_gpt101_inventory.py" --mode daily)
    ;;
  *)
    echo "usage: $0 {inventory-check|inventory-daily}" >&2
    exit 64
    ;;
esac

{
  printf "[%s] START %s\n" "$(date -Is)" "$job"
  if flock -n 9; then
    set +e
    "${cmd[@]}"
    status=$?
    set -e
    printf "[%s] END %s status=%s\n" "$(date -Is)" "$job" "$status"
    exit "$status"
  fi
  printf "[%s] SKIP %s lock held\n" "$(date -Is)" "$job"
  exit 0
} 9>"$lock_file" >>"$log_file" 2>&1
