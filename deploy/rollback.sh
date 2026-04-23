#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR"
BACKUP_DIR="$DEPLOY_DIR/backups"
DEFAULT_IMAGE_REPOSITORY="ghcr.io/afreecoder/gpt101"

# --- 工具函数 ---

backup_db() {
  mkdir -p "$BACKUP_DIR"
  local DB_USER DB_NAME BACKUP_FILE
  DB_USER="$(docker exec gpt101-postgres printenv POSTGRES_USER)"
  DB_NAME="$(docker exec gpt101-postgres printenv POSTGRES_DB)"
  BACKUP_FILE="${BACKUP_DIR}/pre-deploy-$(date +%Y%m%d_%H%M%S).sql.gz"
  echo "备份数据库..."
  docker exec gpt101-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
    | gzip > "$BACKUP_FILE"
  if [ -s "$BACKUP_FILE" ] && gzip -t "$BACKUP_FILE"; then
    echo "备份成功: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  else
    echo "备份失败！" >&2
    rm -f "$BACKUP_FILE"
    return 1
  fi
}

tag_current() {
  local current_commit
  current_commit="$(cd "$APP_DIR" && git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  local rollback_ts="$(date +%Y%m%d_%H%M%S)"
  local rollback_tag="gpt101:rollback-${rollback_ts}-${current_commit}"
  local current_image_id current_image_ref

  current_image_id="$(docker inspect --format '{{.Image}}' gpt101 2>/dev/null || true)"
  current_image_ref="$(docker inspect --format '{{.Config.Image}}' gpt101 2>/dev/null || true)"

  if [ -n "$current_image_id" ]; then
    docker tag "$current_image_id" "$rollback_tag"
    docker tag "$current_image_id" gpt101:rollback-latest
    mkdir -p "$BACKUP_DIR"
    {
      echo "created_at=$rollback_ts"
      echo "source_commit=$current_commit"
      echo "source_image=${current_image_ref:-unknown}"
      echo "rollback_tag=$rollback_tag"
      echo "rollback_alias=gpt101:rollback-latest"
    } > "$BACKUP_DIR/last-rollback-image.txt"
    echo "已创建回退镜像: $rollback_tag"
  else
    echo "未发现正在运行的 gpt101 容器" >&2
    return 1
  fi
}

upsert_env() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
    rm -f "${file}.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

resolve_image_repository() {
  if [ -n "${APP_IMAGE_REPOSITORY:-}" ]; then
    printf '%s\n' "$APP_IMAGE_REPOSITORY"
    return 0
  fi
  if [ -f "$DEPLOY_DIR/.env" ]; then
    local env_repo
    env_repo="$(grep '^APP_IMAGE_REPOSITORY=' "$DEPLOY_DIR/.env" | tail -1 | cut -d= -f2- || true)"
    if [ -n "$env_repo" ]; then
      printf '%s\n' "$env_repo"
      return 0
    fi
  fi
  printf '%s\n' "$DEFAULT_IMAGE_REPOSITORY"
}

deploy_with_image() {
  local image_tag="$1"
  if ! docker image inspect "$image_tag" >/dev/null 2>&1; then
    echo "本地未找到镜像，尝试拉取: $image_tag"
    docker pull "$image_tag"
  fi
  docker tag "$image_tag" gpt101:latest
  cd "$DEPLOY_DIR"
  upsert_env "$DEPLOY_DIR/.env" APP_IMAGE "$image_tag"
  upsert_env "$DEPLOY_DIR/.env" APP_IMAGE_REPOSITORY "$(resolve_image_repository)"
  docker compose up -d --remove-orphans gpt101 gpt101-worker
  echo "已使用镜像 $image_tag 重启服务"
}

restore_db() {
  local backup_file="$1"
  if [ ! -f "$backup_file" ]; then
    echo "备份文件不存在: $backup_file" >&2
    return 1
  fi
  local DB_USER DB_NAME
  DB_USER="$(docker exec gpt101-postgres printenv POSTGRES_USER)"
  DB_NAME="$(docker exec gpt101-postgres printenv POSTGRES_DB)"

  echo "停止应用服务..."
  cd "$DEPLOY_DIR"
  docker compose stop gpt101 gpt101-worker

  echo "恢复数据库: $backup_file → $DB_NAME"
  gunzip -c "$backup_file" | docker exec -i gpt101-postgres psql -U "$DB_USER" -d "$DB_NAME"
  echo "数据库恢复完成"
}

latest_backup_file() {
  ls -t "$BACKUP_DIR"/pre-deploy-*.sql.gz 2>/dev/null | head -1
}

checkout_source_version() {
  local ref="$1"
  cd "$APP_DIR"
  git fetch origin
  git checkout --force --detach "$ref"
  git reset --hard "$ref"
  git clean -fd
}

# --- 命令路由 ---

case "${1:-help}" in
  image)
    image_tag="${2:-gpt101:rollback-latest}"
    echo "=== 镜像回滚: $image_tag ==="
    deploy_with_image "$image_tag"
    ;;

  source)
    commit="${2:?用法: rollback.sh source <git-commit>}"
    echo "=== 源码回滚: $commit ==="
    backup_db
    checkout_source_version "$commit"
    image_tag="$(resolve_image_repository):$commit"
    deploy_with_image "$image_tag"
    echo "源码回滚完成: $commit ($image_tag)"
    ;;

  db-restore)
    case "${2:-}" in
      ""|--with-image|--with-source)
        backup_file="$(latest_backup_file)"
        shift
        ;;
      *)
        backup_file="$2"
        shift 2
        ;;
    esac
    if [ -z "$backup_file" ]; then
      echo "未找到备份文件" >&2; exit 1
    fi
    case "${1:-}" in
      --with-image)
        image_tag="${2:-gpt101:rollback-latest}"
        restore_db "$backup_file"
        deploy_with_image "$image_tag"
        ;;
      --with-source)
        commit="${2:?用法: rollback.sh db-restore <file> --with-source <commit>}"
        restore_db "$backup_file"
        checkout_source_version "$commit"
        image_tag="$(resolve_image_repository):$commit"
        deploy_with_image "$image_tag"
        ;;
      *)
        echo "db-restore 必须指定恢复后的应用版本:" >&2
        echo "  rollback.sh db-restore [file] --with-image [tag]" >&2
        echo "  rollback.sh db-restore [file] --with-source <commit>" >&2
        exit 1
        ;;
    esac
    echo "数据库恢复 + 应用回滚完成"
    ;;

  prep)
    echo "=== 部署准备：打标签 + 备份 ==="
    tag_current
    backup_db
    ;;

  tag-current)
    tag_current
    ;;

  backup-db)
    backup_db
    ;;

  list-backups)
    echo "=== 数据库备份列表 ==="
    ls -lh "$BACKUP_DIR"/pre-deploy-*.sql.gz 2>/dev/null || echo "无备份"
    ;;

  list-images)
    echo "=== 回滚镜像列表 ==="
    docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}' \
      | grep 'gpt101:rollback' || echo "无回滚镜像"
    if [ -f "$BACKUP_DIR/last-rollback-image.txt" ]; then
      echo ""
      echo "--- 最近一次回滚元数据 ---"
      cat "$BACKUP_DIR/last-rollback-image.txt"
    fi
    ;;

  help|*)
    echo "用法: rollback.sh <command> [options]"
    echo ""
    echo "命令:"
    echo "  image [tag]                          镜像回滚（默认 rollback-latest）"
    echo "  source <commit>                      切换到该 commit 对应的 GHCR 镜像"
    echo "  db-restore [file] --with-image [tag] 数据库恢复 + 镜像回滚"
    echo "  db-restore [file] --with-source <commit>"
    echo "                                       数据库恢复 + GHCR 镜像回滚"
    echo "  prep                                 打标签 + 备份"
    echo "  tag-current                          仅打镜像标签"
    echo "  backup-db                            仅备份数据库"
    echo "  list-backups                         列出备份"
    echo "  list-images                          列出回滚镜像"
    ;;
esac
