# GPT101 自动部署方案

## 一、部署目标

将 GPT101（Next.js 应用 + Worker 进程 + PostgreSQL）通过 GitHub Actions 自动部署到 silicon 服务器，具备完整的数据库备份和多层回滚能力。

### 1.1 核心要求

- Docker Compose 部署，三个服务：gpt101（Next.js）、gpt101-worker、gpt101-postgres
- GitHub Actions 通过 SSH 执行部署脚本
- 部署前自动备份数据库，备份失败则中止部署
- 三层回滚机制（镜像回滚 / 源码回滚 / 数据库恢复）
- 分支部署：当前从 `feature/upgrade-system` 部署，不触发 Vercel（main 分支不动）
- 健康检查通过后才算部署成功

### 1.2 约束条件

| 项目     | 值                                                        |
| -------- | --------------------------------------------------------- |
| 服务器   | silicon，2C8G，OpenCloudOS 5.4，Docker 26.1，Caddy 2.10.2 |
| 部署路径 | `/home/work/projects/gpt101`（已有旧代码目录）            |
| 部署用户 | work（非 root）                                           |
| 端口     | Next.js → 127.0.0.1:3001，Caddy 反代 gpt101.org           |
| 分支     | 当前：`feature/upgrade-system`；验证通过后切回 main       |
| 现有服务 | mysql8（127.0.0.1:8306）、Caddy、其他项目共用同一台机器   |

---

## 二、部署触发策略

### 2.1 触发方式：手动触发（workflow_dispatch）

```yaml
on:
  workflow_dispatch:
    inputs:
      branch:
        description: '部署分支'
        required: true
        default: 'main'
```

> 默认值建议设为 `main`；验证 `feature/upgrade-system` 时，在 GitHub Actions 触发界面手动选择该分支。

**理由：**

- 分支部署是过渡阶段，手动触发更可控
- 支持部署任意分支，不硬编码分支名
- 后续验证通过后，加一行 `push: branches: [main]` 即可切回自动部署
- 避免开发期间频繁推送导致反复部署

### 2.2 后续切换计划

验证通过后：

1. 合并 `feature/upgrade-system` → `main`
2. deploy.yml 增加 `push: branches: [main]` 触发
3. DNS 从 Vercel 切到 silicon
4. 关闭 Vercel 上的 gpt101 项目

---

## 三、服务器准备

### 3.1 Caddy 配置

在 `/etc/caddy/Caddyfile` 追加：

```caddy
# GPT101 (自动 HTTPS)
gpt101.org {
    reverse_proxy 127.0.0.1:3001
}
```

> 注意：当前 DNS 指向 Vercel，Caddy 配置可以提前准备但不会生效。切换 DNS 后即时生效。分支部署验证阶段可以用 IP + hosts 文件或临时域名测试。

### 3.2 项目目录

silicon 上已有 `~/projects/gpt101` 目录（旧代码，非 Git 仓库）。部署脚本会按三种情况处理：

1. 目录不存在 → 直接 clone
2. 目录存在且是有效 Git 仓库 → fetch + checkout
3. 目录存在但不是 Git 仓库 → 备份重命名为 `gpt101.bak.YYYYMMDD_HHMMSS`，再重新 clone

部署结构：

```
~/projects/gpt101/                  # 项目根目录（Git 仓库）
├── deploy/
│   ├── docker-compose.yml         # 生产编排
│   ├── .env                       # 生产环境变量（手动创建，不入库）
│   ├── .env.example               # 环境变量模板
│   ├── rollback.sh                # 回滚工具
│   └── backups/                   # 自动管理
│       ├── pre-deploy-*.sql.gz    # 部署前数据库备份
│       └── last-rollback-image.txt # 回滚元数据
├── Dockerfile
├── worker.ts
└── ...
```

### 3.3 前置条件

1. **GitHub 拉取权限**：silicon 上的 `work` 用户必须能通过 SSH 访问 GitHub 仓库。需要：
   - 为 `work` 用户生成 SSH 密钥对（如果还没有）
   - 将公钥添加为仓库的 Deploy Key（只读即可），或添加到 GitHub 账号的 SSH Keys
   - 验证：`ssh -T git@github.com` 应返回认证成功

2. **GitHub Actions SSH 权限**：GitHub Secrets 中配置的 `SILICON_SSH_PRIVATE_KEY` 对应的公钥已添加到 `work` 用户的 `~/.ssh/authorized_keys`

### 3.4 首次部署前手动操作

```bash
# 1. 验证 GitHub SSH 连接
ssh -T git@github.com

# 2. 确保 deploy/.env 已创建并填好（从 .env.example 复制）
cd ~/projects/gpt101/deploy
cp .env.example .env
vim .env  # 填入 POSTGRES_PASSWORD、AUTH_SECRET 等

# 3. Caddy 配置（DNS 切换前可先加好，不影响现有服务）
sudo vim /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 四、GitHub Actions 部署流程

### 4.1 流程概览

```
手动触发 workflow_dispatch（选择分支）
    ↓
SSH 连接 silicon（work 用户）
    ↓
① 磁盘空间检查（≥ 5GB）
    ↓
② 数据库备份（pg_dump → gzip，验证完整性）
   ├─ 备份失败 → 中止部署
   └─ 首次部署（无 postgres 容器）→ 跳过
    ↓
③ 拉取代码（git fetch + checkout 指定分支）
    ↓
④ 保存当前镜像为回滚标签
    ↓
⑤ 构建镜像（docker compose build）
    ↓
⑥ 清理残留容器（防 Compose recreate 冲突）
    ↓
⑦ 启动服务（docker compose up -d）
    ↓
⑧ 健康检查（postgres → gpt101 → worker 日志）
   ├─ 失败 → 输出日志，退出非零（GitHub Actions 标红）
   └─ 成功 → 继续
    ↓
⑨ 清理悬空镜像 + 过期备份（7 天）
    ↓
部署完成 ✓
```

### 4.2 deploy.yml 设计

文件：`.github/workflows/deploy.yml`

```yaml
name: Deploy to Silicon

on:
  workflow_dispatch:
    inputs:
      branch:
        description: '部署分支'
        required: true
        default: 'main'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SILICON_HOST }}
          username: work
          key: ${{ secrets.SILICON_SSH_PRIVATE_KEY }}
          command_timeout: 30m
          script: |
            set -euo pipefail
            # ... 完整部署脚本（见 4.3）
```

### 4.3 部署脚本详细设计

```bash
set -euo pipefail

APP_DIR="$HOME/projects/gpt101"
DEPLOY_DIR="$APP_DIR/deploy"
BACKUP_DIR="$DEPLOY_DIR/backups"
REPO_URL="git@github.com:AFreeCoder/gpt101.git"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

# --- 工具函数 ---

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令: $1" >&2; exit 1
  }
}

tag_current_image_for_rollback() {
  local current_commit="$1"
  local rollback_ts="$(date +%Y%m%d_%H%M%S)"
  local rollback_tag="gpt101:rollback-${rollback_ts}-${current_commit}"

  if docker image inspect gpt101:latest >/dev/null 2>&1; then
    docker tag gpt101:latest "$rollback_tag"
    docker tag gpt101:latest gpt101:rollback-latest
    {
      echo "created_at=$rollback_ts"
      echo "source_commit=$current_commit"
      echo "rollback_tag=$rollback_tag"
      echo "rollback_alias=gpt101:rollback-latest"
    } > "$BACKUP_DIR/last-rollback-image.txt"
    echo "已创建回退镜像标签: $rollback_tag"
  else
    echo "未发现 gpt101:latest，跳过回退镜像打标"
  fi
}

wait_for_health() {
  local name="$1"
  local timeout="${2:-180}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    local state
    state="$(docker inspect --format \
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "$name" 2>/dev/null || true)"
    case "$state" in
      healthy|running) echo "$name 状态正常: $state"; return 0 ;;
      unhealthy|exited|dead)
        echo "$name 状态异常: $state" >&2
        docker logs --tail 200 "$name" || true
        return 1 ;;
    esac
    sleep 5
    elapsed=$((elapsed + 5))
  done
  echo "等待 $name 健康检查超时" >&2
  docker logs --tail 200 "$name" || true
  return 1
}

# --- 前置检查 ---

require_command git
require_command docker
require_command gzip

FREE_KB="$(df -Pk "$HOME" | awk 'NR==2 {print $4}')"
if [ -z "$FREE_KB" ] || [ "$FREE_KB" -lt $((5 * 1024 * 1024)) ]; then
  echo "可用磁盘不足 5GB，停止部署" >&2
  exit 1
fi

# --- 部署前数据库备份 ---

mkdir -p "$BACKUP_DIR"
if docker ps --filter "name=^gpt101-postgres$" --format '{{.Names}}' | grep -q .; then
  DB_USER="$(docker exec gpt101-postgres printenv POSTGRES_USER)"
  DB_NAME="$(docker exec gpt101-postgres printenv POSTGRES_DB)"
  if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "无法读取数据库用户/库名，停止部署" >&2
    exit 1
  fi

  BACKUP_FILE="${BACKUP_DIR}/pre-deploy-$(date +%Y%m%d_%H%M%S).sql.gz"
  echo "开始部署前备份..."
  docker exec gpt101-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
    | gzip > "$BACKUP_FILE"

  if [ -s "$BACKUP_FILE" ] && gzip -t "$BACKUP_FILE"; then
    echo "备份成功: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    find "$BACKUP_DIR" -name "pre-deploy-*.sql.gz" -mtime +7 -delete
  else
    echo "备份失败，中止部署！" >&2
    rm -f "$BACKUP_FILE"
    exit 1
  fi
else
  echo "首次部署，跳过数据库备份"
fi

# --- 拉取代码 ---

if [ -d "$APP_DIR/.git" ]; then
  # 情况 2：已有有效 Git 仓库
  echo "检测到已有 Git 仓库: $APP_DIR"
elif [ -d "$APP_DIR" ]; then
  # 情况 3：目录存在但不是 Git 仓库，备份后重新 clone
  BAK_DIR="${APP_DIR}.bak.$(date +%Y%m%d_%H%M%S)"
  echo "目录存在但不是 Git 仓库，备份为: $BAK_DIR"
  mv "$APP_DIR" "$BAK_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  # 情况 1：目录不存在，直接 clone
  echo "首次部署，克隆仓库..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [ "$CURRENT_REMOTE" != "$REPO_URL" ]; then
  git remote set-url origin "$REPO_URL"
fi

CURRENT_DEPLOY_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
tag_current_image_for_rollback "$CURRENT_DEPLOY_COMMIT"

git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

# --- 构建并部署 ---

cd "$DEPLOY_DIR"
if [ ! -f .env ]; then
  echo "缺少 $DEPLOY_DIR/.env，停止部署" >&2
  exit 1
fi

APP_COMMIT="$(git rev-parse --short=12 HEAD)"
echo "部署提交: ${APP_COMMIT} (分支: ${DEPLOY_BRANCH})"

docker compose config -q
docker compose build

# 清理残留容器（防 Compose recreate 冲突）
for stale in $(docker ps -a --format '{{.Names}}' | grep -E '^[0-9a-f]+_gpt101'); do
  echo "清理残留容器: $stale"
  docker rm -f "$stale" 2>/dev/null || true
done

docker compose up -d --remove-orphans

# --- 健康检查 ---

wait_for_health gpt101-postgres 180
wait_for_health gpt101 300

# Worker 没有 healthcheck，检查容器是否在运行
sleep 5
WORKER_STATE="$(docker inspect --format '{{.State.Status}}' gpt101-worker 2>/dev/null || echo unknown)"
if [ "$WORKER_STATE" != "running" ]; then
  echo "gpt101-worker 状态异常: $WORKER_STATE" >&2
  docker logs --tail 200 gpt101-worker || true
  exit 1
fi
echo "gpt101-worker 状态正常: running"

# --- 清理 ---

docker image prune -f
echo "部署完成！提交: ${APP_COMMIT}，分支: ${DEPLOY_BRANCH}"
```

### 4.4 GitHub Secrets 配置

| Secret 名称               | 说明                 |
| ------------------------- | -------------------- |
| `SILICON_HOST`            | silicon 服务器 IP    |
| `SILICON_SSH_PRIVATE_KEY` | work 用户的 SSH 私钥 |

### 4.5 分支变量传递

deploy.yml 中通过 `envs` 传递分支参数给脚本：

```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.SILICON_HOST }}
    username: work
    key: ${{ secrets.SILICON_SSH_PRIVATE_KEY }}
    command_timeout: 30m
    envs: DEPLOY_BRANCH
    script: |
      # 脚本内容...
  env:
    DEPLOY_BRANCH: ${{ github.event.inputs.branch }}
```

---

## 五、数据库备份机制

### 5.1 自动备份

| 时机       | 方式                 | 保留策略          |
| ---------- | -------------------- | ----------------- |
| 每次部署前 | pg_dump + gzip       | 自动清理 7 天以上 |
| 手动回滚前 | rollback.sh 自动执行 | 同上              |

备份文件命名：`pre-deploy-YYYYMMDD_HHMMSS.sql.gz`

### 5.2 备份验证

- `gzip -t` 检查压缩完整性
- 文件大小检查（`-s` 非空）
- 任一检查失败则中止部署

### 5.3 备份存储位置

```
~/projects/gpt101/deploy/backups/
├── pre-deploy-20260413_120000.sql.gz
├── pre-deploy-20260414_150000.sql.gz
└── last-rollback-image.txt
```

---

## 六、回滚机制

参考 apipool 的三层回滚设计，提供 `deploy/rollback.sh` 工具。

### 6.1 第一层：镜像回滚（最快，~30 秒）

```bash
./rollback.sh image [tag]
```

- 每次部署前自动打标签：`gpt101:rollback-YYYYMMDD_HHMMSS-<commit>`
- 别名：`gpt101:rollback-latest`（最近一次部署前的镜像）
- 不涉及数据库，只重建容器
- 适用场景：新版本应用有 bug，数据库没问题

### 6.2 第二层：源码回滚

```bash
./rollback.sh source <git-commit>
```

- git checkout 到指定 commit
- 重新构建镜像并部署
- 适用场景：回滚标签已被清理，或需要回到特定历史版本

### 6.3 第三层：数据库恢复（最后手段）

```bash
./rollback.sh db-restore [backup-file] --with-image [tag]
./rollback.sh db-restore [backup-file] --with-source <commit>
```

- 高危操作，需要显式指定恢复后运行哪个版本的应用
- 先停应用，恢复数据库，再启动指定版本
- 适用场景：数据库 migration 出问题
- 省略 `backup-file` 时，默认使用最近一次 `pre-deploy-*.sql.gz` 备份

### 6.4 辅助命令

```bash
./rollback.sh prep          # 打镜像标签 + 备份数据库（手动部署前用）
./rollback.sh tag-current   # 仅打镜像标签
./rollback.sh backup-db     # 仅备份数据库
./rollback.sh list-backups  # 列出所有备份
./rollback.sh list-images   # 列出所有回滚镜像
```

### 6.5 rollback.sh 设计

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR"
BACKUP_DIR="$DEPLOY_DIR/backups"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"

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
  # 用指定镜像替换 docker-compose 的 build
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
```

---

## 七、Docker Compose 调整

当前 `deploy/docker-compose.yml` 基本满足需求，需要做以下调整：

### 7.1 镜像标签固定

当前 compose 使用 `build` 指令，构建出的镜像默认名为 `deploy-gpt101`。为了回滚机制统一镜像标签，需要加 `image` 字段：

```yaml
services:
  gpt101:
    build:
      context: ..
      dockerfile: Dockerfile
    image: gpt101:latest # 新增：固定镜像名
    # ... 其余不变

  gpt101-worker:
    image: gpt101:latest # 新增：复用同一镜像，不再重复 build
    container_name: gpt101-worker
    command: ['node', 'worker.js']
    # ... 其余不变，删除 build 段
```

这样：

- `docker compose build` 只构建一次，标记为 `gpt101:latest`
- worker 直接复用同一镜像
- 回滚时 `docker tag gpt101:rollback-latest gpt101:latest` 后 `docker compose up -d` 即可

### 7.2 一次性运维容器 `gpt101-ops`

为了解决“运行时镜像只有 Next standalone 和 `worker.js`，不包含 `scripts/`、Drizzle 配置和开发依赖”的问题，部署方案中新增一个**仅手动使用**的临时运维容器 `gpt101-ops`，专门用于：

- 首次部署时执行 `db:push`
- 初始化 RBAC
- 后续手动执行 schema 变更

它不是常驻服务，不暴露端口，不参与正常流量处理。

```yaml
gpt101-ops:
  image: node:20-alpine
  profiles: ['ops'] # 仅在手动启用时运行
  working_dir: /workspace
  entrypoint: ['sh', '-lc']
  volumes:
    - ..:/workspace
    - /workspace/node_modules
  networks:
    - gpt101-network
```

这样处理后：

- 日常 `docker compose up -d` 不会启动 `gpt101-ops`
- 需要执行 schema / RBAC 初始化时，用 `docker compose --profile ops run --rm gpt101-ops '...'`
- 不需要改当前 `Dockerfile`，也不要求把开发脚本塞进运行时镜像

### 7.3 Worker 健康检查（可选）

当前 worker 没有 healthcheck，部署脚本通过检查容器 running 状态替代。如果后续需要更精确的检查，可以加一个简单的进程存活检测：

```yaml
gpt101-worker:
  healthcheck:
    test: ['CMD-SHELL', "pgrep -f 'node worker.js' || exit 1"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 10s
```

---

## 八、数据库 Migration

### 8.1 当前方案

GPT101 使用 Drizzle ORM，migration 通过 `pnpm db:push` 执行（schema push 模式，非 migration 文件模式）。

### 8.2 部署时 Migration 策略

**不在部署脚本中自动执行 migration。** 理由：

- `db:push` 是破坏性操作（可能 drop column），不适合自动执行
- 升级系统的 schema 已经在开发阶段手动 push 过
- 后续如果切换到 migration 文件模式，再在部署流程中加入

### 8.3 首次部署：Schema 初始化

首次部署采用**两阶段流程**：

1. **服务器 Bootstrap 阶段**：只准备仓库、`.env`、postgres、schema、RBAC
2. **正式部署阶段**：再触发 GitHub Actions 启动 Web 和 Worker

这样可以避免出现“应用和 Worker 已经启动，但数据库表和权限还没初始化”的窗口期。

**执行方式：通过 `gpt101-ops` 一次性运维容器运行**（不依赖宿主机 Node 环境，也不依赖运行时镜像包含开发脚本）：

```bash
# 0. 准备仓库并进入项目目录
cd ~/projects/gpt101
git fetch origin feature/upgrade-system
git checkout feature/upgrade-system
git reset --hard origin/feature/upgrade-system

# 1. 先只启动 postgres
cd deploy
docker compose up -d gpt101-postgres

# 2. 等待 postgres healthy
until [ "$(docker inspect --format '{{.State.Health.Status}}' gpt101-postgres 2>/dev/null)" = "healthy" ]; do
  sleep 3
done

# 3. 用一次性运维容器执行 schema 初始化 + RBAC 初始化
cd ..
docker compose --profile ops -f deploy/docker-compose.yml run --rm gpt101-ops '
  set -euo pipefail
  apk add --no-cache libc6-compat
  corepack enable
  pnpm install --frozen-lockfile
  set -a
  . ./deploy/.env
  set +a
  export DATABASE_PROVIDER=postgresql
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@gpt101-postgres:5432/${POSTGRES_DB}"
  pnpm exec drizzle-kit push --config=src/core/db/config.ts
  pnpm exec tsx scripts/init-rbac.ts --admin-email=xxx@xxx.com
'
```

关键点：

- `gpt101-ops` 挂载的是仓库源码，所以 `scripts/init-rbac.ts`、`src/core/db/config.ts`、`package.json` 都真实存在
- `set -a; . ./deploy/.env; set +a` 明确把 `deploy/.env` 中的 `POSTGRES_*` 变量导入当前 shell，避免变量为空
- `DATABASE_URL` 指向 Docker 网络内的 `gpt101-postgres:5432`
- 完成后再触发正式部署，启动 Web 和 Worker

> 注意：这里**不能**直接用 `gpt101` 运行时镜像执行 `db:push` / `init-rbac`，因为当前运行时镜像只包含 Next standalone 产物和 `worker.js`，不包含 `scripts/`、Drizzle 配置文件和开发依赖。

### 8.4 后续 Schema 变更流程

1. 开发分支修改 schema
2. 推送代码后，先在 silicon 上同步仓库到目标分支
3. 通过 `gpt101-ops` 一次性容器执行 `db:push`（方式同上）
4. 确认 schema 变更成功后，再触发 GitHub Actions 正式部署
5. 如果 schema 变更出问题，用 `rollback.sh db-restore` 恢复

---

## 九、验证阶段的访问方式

DNS 还指向 Vercel 时，如何验证 silicon 上的部署：

### 方案 A：本地 hosts 文件

```bash
# 在本地 /etc/hosts 添加
<silicon-ip> gpt101.org
```

Caddy 会自动处理 HTTPS（如果配置了 gpt101.org），但因为 DNS 不指向 silicon，Let's Encrypt 证书签发会失败。

### 方案 B：临时子域名（推荐）

1. 添加 DNS 记录：`staging.gpt101.org` → silicon IP
2. Caddy 配置：

```caddy
staging.gpt101.org {
    reverse_proxy 127.0.0.1:3001
}
```

3. docker-compose 中 `APP_URL` 临时改为 `https://staging.gpt101.org`
4. 验证通过后删除临时配置，切换正式域名

### 方案 C：IP + 端口直接访问

临时将 docker-compose 中 gpt101 的端口改为 `0.0.0.0:3001:3000`，通过 `http://<silicon-ip>:3001` 直接访问。验证完改回 `127.0.0.1:3001:3000`。

---

## 十、安全考虑

### 10.1 SSH 密钥

- GitHub Secrets 中存储 work 用户的 SSH 私钥
- 建议为部署生成专用密钥对，不与日常 SSH 混用
- 服务器端 `~/.ssh/authorized_keys` 添加对应公钥

### 10.2 .env 文件

- `deploy/.env` 不入 Git（已在 .gitignore 中）
- 包含 POSTGRES_PASSWORD、AUTH_SECRET 等敏感信息
- 首次手动创建，后续部署不覆盖

### 10.3 端口暴露

- PostgreSQL 只在 Docker 内部网络暴露，不映射到宿主机
- Next.js 绑定 127.0.0.1:3001，只接受 Caddy 反代
- Worker 不暴露端口

### 10.4 容器用户

- Next.js 和 Worker 以 nextjs 用户（uid 1001）运行，非 root
- PostgreSQL 使用官方镜像默认的 postgres 用户

---

## 十一、文件变更清单

本方案需要新增/修改以下文件：

| 操作 | 文件                           | 说明                                                                           |
| ---- | ------------------------------ | ------------------------------------------------------------------------------ |
| 新增 | `.github/workflows/deploy.yml` | 部署 GitHub Actions                                                            |
| 新增 | `deploy/rollback.sh`           | 回滚工具脚本                                                                   |
| 修改 | `deploy/docker-compose.yml`    | 加 `image: gpt101:latest`，worker 去掉 build，并新增 `gpt101-ops` 临时运维服务 |
| 修改 | `.gitignore`                   | 显式添加 `deploy/.env` 和 `deploy/backups/` 排除规则                           |

### 不需要修改的文件

- `Dockerfile` — 已经就绪（含 esbuild worker.ts）
- `deploy/.env.example` — 已经就绪
- `.github/workflows/docker-build.yaml` — 保留，用于 GHCR 镜像构建（独立于部署）

---

## 十二、操作步骤汇总

### 首次部署

1. **本地**：提交 deploy.yml、rollback.sh、docker-compose.yml 修改，推送到 `feature/upgrade-system`
2. **GitHub**：配置 Secrets（SILICON_HOST、SILICON_SSH_PRIVATE_KEY）
3. **Silicon 前置准备**：
   - 确认 `work` 用户已具备 GitHub SSH 拉取权限（`ssh -T git@github.com`）
   - 首次需要手动准备仓库目录：`git clone git@github.com:AFreeCoder/gpt101.git ~/projects/gpt101`
   - 创建 `deploy/.env`（从 .env.example 复制并填值）
   - 配置 Caddy（staging 子域名或直接 gpt101.org）
4. **Silicon Bootstrap**（首次仅执行一次）：
   - 同步到目标分支：`git fetch origin feature/upgrade-system && git checkout feature/upgrade-system && git reset --hard origin/feature/upgrade-system`
   - 先只启动 postgres：`cd ~/projects/gpt101/deploy && docker compose up -d gpt101-postgres`
   - 用 `gpt101-ops` 一次性容器执行 `db:push` 和 `rbac:init`（见第八章 8.3）
5. **GitHub Actions**：Bootstrap 完成后，再手动触发 Deploy to Silicon，选择 `feature/upgrade-system` 分支
   - 这一步才启动 Web 和 Worker
6. **验证**：通过 staging 域名或 hosts 文件访问验证

### 日常部署

1. 推送代码到 `feature/upgrade-system`
2. GitHub Actions 手动触发部署
3. 自动：备份 → 拉代码 → 构建 → 部署 → 健康检查
4. 出问题：`ssh silicon` → `cd ~/projects/gpt101/deploy` → `./rollback.sh image`

### 切换到 main 自动部署

1. 合并 `feature/upgrade-system` → `main`
2. deploy.yml 增加 `push: branches: [main]` 触发条件
3. DNS 切换 gpt101.org → silicon IP
4. Caddy 确认 gpt101.org 配置
5. 关闭 Vercel 项目

---

## 十三、Codex 评审意见（2026-04-13）

以下评审基于当前文档方案与仓库现状对照得出，按风险高低排序。

### 13.1 高风险问题

#### 1. 部署前数据库备份不能真正保证“失败即中止”

当前部署脚本使用的是：

```bash
set -e
docker exec gpt101-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$BACKUP_FILE"
```

问题在于这里只用了 `set -e`，没有启用 `pipefail`。  
如果 `pg_dump` 失败，而 `gzip` 仍然正常退出，整个 pipeline 可能被当作成功处理。这样就会出现“备份实际上失败，但部署继续执行”的情况，与“备份失败则中止部署”的目标不一致。

**建议：**

- 统一改为：

```bash
set -euo pipefail
```

- 把 `pg_dump` 失败视为明确失败条件
- 保留现有的 `gzip -t` 和非空检查作为第二层校验

#### 2. 仓库拉取链路不完整，首次部署可能直接卡在 git clone / fetch

文档中的仓库地址是：

```bash
REPO_URL="git@github.com:AFreeCoder/gpt101.org.git"
```

但当前本地仓库实际 `origin` 是：

```bash
git@github.com:AFreeCoder/gpt101.git
```

也就是说，文档里的仓库地址当前与仓库实际 remote 不一致。

此外，GitHub Actions 只是通过 SSH 登录 silicon，真正执行 `git clone` / `git fetch` 的是服务器上的 `work` 用户。因此除了 GitHub Actions 到 silicon 的 SSH 私钥外，还必须明确：

- silicon 服务器如何访问 GitHub 仓库
- `work` 用户是否已配置 GitHub deploy key / 机器用户 SSH key
- 首次 clone 是否已经验证过

如果这条链路未提前打通，部署会在拉代码步骤直接失败。

**建议：**

- 先修正文档中的 `REPO_URL`
- 明确增加一条前置条件：
  - `work` 用户已具备从 GitHub 拉取仓库的权限
- 或者改为由 GitHub Actions 在 runner 侧打包代码后上传到服务器，避免服务器端再访问 GitHub

### 13.2 中风险问题

#### 3. 首次部署的 migration / RBAC 初始化步骤写法不够可执行，且时序偏后

文档写的是首次部署后手动执行：

```bash
DATABASE_URL="postgresql://gpt101:xxx@localhost:5432/gpt101" npx drizzle-kit push
DATABASE_URL="postgresql://gpt101:xxx@localhost:5432/gpt101" npx tsx scripts/init-rbac.ts --admin-email=xxx@xxx.com
```

但当前项目实际脚本入口是 npm scripts：

- `pnpm db:push`
- `pnpm rbac:init`

并且依赖 `tsx scripts/with-env.ts` 与 `src/core/db/config.ts`。  
文档当前写法默认宿主机具备 Node / pnpm / 依赖环境，而整份方案本身是按 Docker Compose 部署设计的，这里会让首次部署步骤变得不够明确。

另一个问题是：文档把 migration 放在“容器已经启动”之后再做。这样会存在一个窗口期：

- 新版应用已启动
- Worker 已启动
- 但数据库 schema 还没有完成初始化

这会增加首次部署失败和脏状态的概率。

**建议：**

- 明确首次部署到底采用哪一种方式执行 schema 初始化：
  - 宿主机安装 Node + pnpm 后运行项目脚本
  - 或增加一个一次性运维容器来跑 `db:push` / `rbac:init`
- 在正式开放访问前完成 schema 初始化与 RBAC 初始化
- 文档中把“首次部署后手动执行”改成更明确的可执行步骤

#### 4. “已有旧目录但不是 Git 仓库”的场景没有处理完整

文档前面写明：

- `/home/work/projects/gpt101` 是已有旧代码目录
- 没有 `.git` 时重新 clone

但脚本实际写法是：

```bash
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
```

如果 `$APP_DIR` 已经存在、不是 Git 仓库、而且目录非空，那么 `git clone ... "$APP_DIR"` 会直接失败。

**建议：**

把目录状态拆开处理：

1. 目录不存在：直接 clone
2. 目录存在且是有效 Git 仓库：fetch + checkout
3. 目录存在但不是 Git 仓库：先备份/重命名旧目录，再重新 clone

### 13.3 建议优化项

#### 5. `deploy/.env` 和 `deploy/backups/` 的忽略规则最好显式写入 `.gitignore`

文档里写了需要确保：

- `deploy/.env`
- `deploy/backups/`

被忽略。

当前 `.gitignore` 里有通用的 `.env` 规则，但没有显式写 `deploy/backups/`。虽然当前 `backups/` 目录还未入库，但从文档治理角度，最好把这两个路径明确写进去，避免后续误提交。

**建议：**

```gitignore
deploy/.env
deploy/backups/
```

#### 6. Worker 健康检查目前只校验“进程活着”，不校验“任务处理链路可用”

当前方案里对 worker 的健康判断是：

- 容器状态为 `running`
- 或未来加 `pgrep -f 'node worker.js'`

这能证明进程没退出，但不能证明：

- 数据库连接正常
- 任务轮询正常
- adapter 注册完整

这不算错误，但要知道它只是“存活检查”，不是“业务健康检查”。

**建议：**

- 当前阶段保留 `running` 检查即可
- 后续若要增强，可让 worker 定期写入心跳时间到数据库或文件，再据此做健康检查

### 13.4 关于为什么 Docker Compose 中需要独立的 Worker 服务

这个项目里保留独立 `gpt101-worker` 服务是合理的，原因不是“多开一个容器更高级”，而是职责分离。

#### 原因 1：升级任务是异步任务，不适合绑在 Web 请求生命周期里

升级流程不是一个瞬时 HTTP 请求：

- 要轮询任务
- 要按优先级尝试渠道
- 可能要等待第三方几十秒甚至更久
- 失败后还要做卡密回滚、状态变更

如果把这套逻辑直接放在 Web 进程里同步执行：

- 用户请求会长时间占住
- 容易超时
- Web 服务重启时任务执行状态也更难控制

因此更合理的方式是：

- Web：负责接收请求、创建任务、查询状态
- Worker：负责后台轮询和执行 `pending` 任务

#### 原因 2：Web 扩容和 Worker 扩容的诉求不同

Web 容器主要承受的是页面访问和 API 请求。  
Worker 容器主要承受的是：

- 轮询数据库
- 调第三方渠道接口
- 长时间等待和重试

这两类负载的资源模型不同，拆开后更容易单独调整：

- Web 内存/并发
- Worker 轮询频率/并发数量

#### 原因 3：部署和回滚时更容易观察问题

独立 worker 后，部署时可以分别看：

- `gpt101` 是否正常起服务
- `gpt101-worker` 是否正常轮询任务

日志和故障定位也更清晰。  
如果 worker 逻辑直接塞进 Web 容器，很多“页面还活着，但任务没跑”的问题会更难看出来。

#### 原因 4：和当前代码结构一致

当前项目已经明确有独立入口：

- `worker.ts`
- Web 侧只负责创建任务和触发 worker
- Worker 侧负责 `pickAndRunTasks()`

所以 Compose 里单独起一个 `gpt101-worker`，本质上是在匹配当前代码边界，而不是额外增加复杂度。

### 13.5 总结结论

这份部署方案的总体方向是对的，尤其是：

- 手动触发部署
- 部署前数据库备份
- 健康检查后才算成功
- 三层回滚设计

但在真正用于首次上线前，建议至少先修正以下 4 点：

1. 备份脚本加 `pipefail`
2. 修正 `REPO_URL`，并明确服务器到 GitHub 的拉取权限
3. 把首次 migration / RBAC 初始化步骤写成可实际执行的版本
4. 补齐”已有旧目录但不是 Git 仓库”的处理逻辑

### 13.6 修正记录

针对 13.5 提出的 4 个必修项，已全部修正到文档对应章节：

1. **`pipefail`** — 4.2、4.3 部署脚本统一改为 `set -euo pipefail`，确保 `pg_dump | gzip` 管道中任一命令失败都能被捕获
2. **REPO_URL + 拉取权限** — 4.3 修正为 `git@github.com:AFreeCoder/gpt101.git`（与仓库实际 remote 一致）；3.3 新增前置条件章节，明确 `work` 用户 GitHub SSH 权限和验证步骤
3. **首次 migration 时序和执行方式** — 8.3 重写为通过一次性容器（`docker compose run --rm`）执行，不依赖宿主机 Node 环境；时序改为先启动 postgres → schema 初始化 → 再启动应用和 worker；12 章首次部署步骤同步更新
4. **旧目录处理** — 3.2 和 4.3 拉取代码段改为三种情况分支处理：已有 Git 仓库 / 非 Git 目录（备份重命名后 clone）/ 目录不存在（直接 clone）

另外，建议优化项 5（`.gitignore` 显式规则）已纳入第十一章文件变更清单。

### 13.7 第二轮复核结论（Codex）

在本轮修订后，前面剩余的 3 个问题已在部署计划正文中收敛：

1. **运行时镜像无法执行 `db:push` / `init-rbac`**  
   已通过第七章新增 `gpt101-ops` 临时运维容器解决。Schema 初始化和 RBAC 初始化不再依赖 `gpt101` 运行时镜像。

2. **首次部署时序自相矛盾**  
   已通过第八章和第十二章改成“两阶段首次部署”解决：先服务器 Bootstrap（postgres + schema + RBAC），再触发 GitHub Actions 正式部署 Web 和 Worker。

3. **`deploy/.env` 中的变量不会自动进入 shell**  
   已在第八章命令中显式加入：

```bash
set -a
. ./deploy/.env
set +a
```

并在后续命令里明确构造 `DATABASE_URL`，避免 `POSTGRES_*` 为空。

**当前结论：**

- 这份部署计划在文档层面已经基本自洽，可作为下一步落地实现的依据
- 真正执行前，仍需要把第十一章列出的文件修改同步到仓库里，尤其是：
  - `.github/workflows/deploy.yml`
  - `deploy/rollback.sh`
  - `deploy/docker-compose.yml`
  - `.gitignore`

也就是说，**现在的问题已经从“方案本身不自洽”收敛为“按文档把对应部署文件实现出来”**。
