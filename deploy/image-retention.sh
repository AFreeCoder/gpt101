#!/usr/bin/env bash
set -euo pipefail

repository=""
keep_count=3
dry_run=false

usage() {
  cat <<'EOF'
用法: image-retention.sh --repository <镜像仓库> [--keep <数量>] [--dry-run]

仅保留当前运行镜像和最近的成功生产镜像，默认共保留 3 个不同镜像版本。
EOF
}

contains_value() {
  local expected="$1"
  shift
  local value
  for value in "$@"; do
    if [ "$value" = "$expected" ]; then
      return 0
    fi
  done
  return 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repository)
      if [ "$#" -lt 2 ]; then
        usage >&2
        exit 2
      fi
      repository="$2"
      shift 2
      ;;
    --keep)
      if [ "$#" -lt 2 ]; then
        usage >&2
        exit 2
      fi
      keep_count="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$repository" ]; then
  echo "必须通过 --repository 指定镜像仓库" >&2
  exit 2
fi

case "$keep_count" in
  ''|*[!0-9]*)
    echo "--keep 必须是正整数" >&2
    exit 2
    ;;
esac
if [ "$keep_count" -lt 1 ]; then
  echo "--keep 必须大于等于 1" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "缺少命令: docker" >&2
  exit 1
fi

current_image_id="$(docker inspect --format '{{.Image}}' gpt101 2>/dev/null || true)"
if [ -z "$current_image_id" ]; then
  echo "无法读取当前 gpt101 容器镜像，停止清理" >&2
  exit 1
fi

local_refs=()
while IFS= read -r ref; do
  if [ -n "$ref" ]; then
    local_refs+=("$ref")
  fi
done < <(docker image ls --format '{{.Repository}}:{{.Tag}}')

keep_ids=("$current_image_id")
keep_sources=("当前运行容器")

while IFS= read -r ref; do
  [ -n "$ref" ] || continue
  image_id="$(docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null || true)"
  [ -n "$image_id" ] || continue

  if contains_value "$image_id" "${keep_ids[@]}"; then
    continue
  fi
  if [ "${#keep_ids[@]}" -ge "$keep_count" ]; then
    break
  fi

  keep_ids+=("$image_id")
  keep_sources+=("$ref")
done < <(
  for ref in "${local_refs[@]}"; do
    if [[ "$ref" == gpt101:rollback-[0-9]* ]]; then
      printf '%s\n' "$ref"
    fi
  done | LC_ALL=C sort -r
)

evict_ids=()
for ref in "${local_refs[@]}"; do
  case "$ref" in
    gpt101:rollback-*|"$repository":sha-*) ;;
    *) continue ;;
  esac

  image_id="$(docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null || true)"
  [ -n "$image_id" ] || continue
  if contains_value "$image_id" "${keep_ids[@]}"; then
    continue
  fi
  if [ "${#evict_ids[@]}" -eq 0 ] || \
    ! contains_value "$image_id" "${evict_ids[@]}"; then
    evict_ids+=("$image_id")
  fi
done

if [ "$dry_run" = true ]; then
  echo "镜像保留清理预览：不会执行删除"
else
  echo "开始执行镜像保留清理"
fi

echo "当前镜像: $current_image_id"
for index in "${!keep_ids[@]}"; do
  echo "保留镜像: ${keep_ids[$index]} (${keep_sources[$index]})"
done

cleanup_failed=0
removed_refs=0

for image_id in ${evict_ids[@]+"${evict_ids[@]}"}; do
  container_ids="$(
    docker container ls -aq --filter "ancestor=$image_id" 2>/dev/null || true
  )"
  if [ -n "$container_ids" ]; then
    echo "镜像 $image_id 仍被容器引用，跳过清理: $container_ids" >&2
    cleanup_failed=1
    continue
  fi

  image_removed_refs=0
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    case "$ref" in
      gpt101:rollback-*|"$repository":sha-*) ;;
      *) continue ;;
    esac

    if [ "$dry_run" = true ]; then
      echo "将删除本地镜像引用: $ref ($image_id)"
    elif docker image rm "$ref"; then
      echo "已删除本地镜像引用: $ref ($image_id)"
    else
      echo "删除本地镜像引用失败: $ref ($image_id)" >&2
      cleanup_failed=1
      continue
    fi
    image_removed_refs=$((image_removed_refs + 1))
    removed_refs=$((removed_refs + 1))
  done < <(
    docker image inspect \
      --format '{{range .RepoTags}}{{println .}}{{end}}' \
      "$image_id" 2>/dev/null || true
  )

  if [ "$image_removed_refs" -eq 0 ]; then
    echo "镜像 $image_id 没有可清理的 GPT101 本地引用" >&2
    cleanup_failed=1
  fi
done

echo "保留 ${#keep_ids[@]} 个不同镜像版本，处理 $removed_refs 个本地引用"

if [ "$cleanup_failed" -ne 0 ]; then
  echo "镜像保留清理未完全完成，需要人工处理" >&2
  exit 1
fi
