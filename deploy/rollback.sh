#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR"
BACKUP_DIR="$DEPLOY_DIR/backups"

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

  if docker image inspect gpt101:latest >/dev/null 2>&1; then
    docker tag gpt101:latest "$rollback_tag"
    docker tag gpt101:latest gpt101:rollback-latest
    mkdir -p "$BACKUP_DIR"
    {
      echo "created_at=$rollback_ts"
      echo "source_commit=$current_commit"
      echo "rollback_tag=$rollback_tag"
      echo "rollback_alias=gpt101:rollback-latest"
    } > "$BACKUP_DIR/last-rollback-image.txt"
    echo "已创建回退镜像: $rollback_tag"
  else
    echo "未发现 gpt101:latest" >&2
    return 1
  fi
}

deploy_with_image() {
  local image_tag="$1"
  if ! docker image inspect "$image_tag" >/dev/null 2>&1; then
    echo "镜像不存在: $image_tag" >&2
    return 1
  fi
  docker tag "$image_tag" gpt101:latest
  cd "$DEPLOY_DIR"
  docker compose stop gpt101 gpt101-worker
  docker compose up -d gpt101 gpt101-worker
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
    cd "$DEPLOY_DIR"
    docker compose build
    docker compose up -d --remove-orphans
    echo "源码回滚完成: $commit"
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
        cd "$DEPLOY_DIR"
        docker compose build
        docker compose up -d --remove-orphans
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
    echo "  source <commit>                      源码回滚"
    echo "  db-restore [file] --with-image [tag] 数据库恢复 + 镜像回滚"
    echo "  db-restore [file] --with-source <commit>"
    echo "                                       数据库恢复 + 源码回滚"
    echo "  prep                                 打标签 + 备份"
    echo "  tag-current                          仅打镜像标签"
    echo "  backup-db                            仅备份数据库"
    echo "  list-backups                         列出备份"
    echo "  list-images                          列出回滚镜像"
    ;;
esac
