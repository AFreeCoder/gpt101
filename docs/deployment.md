# GPT101 部署手册

本文件是 GPT101 的生产发布事实源。发布前必须先读取本文件和下方列出的部署关键文件；不要只依赖历史计划文档或会话记忆。

## Release Target

- Release branch: `main`
- Release environments: production
- Production URL: `https://gpt101.org`
- Staging URL: 当前未在仓库中声明独立 staging 环境
- Owner or escalation contact: 仓库所有者 / 当前发布操作者

## Trigger

- Deployment trigger:
  - push 到 `main` 会触发 `.github/workflows/docker-build.yaml`
  - `Build and Push Docker Image` 在 `main` push 成功后，会通过 `workflow_run` 触发 `.github/workflows/deploy.yml`
  - 也可以在 GitHub Actions 中手动触发 `Deploy to Silicon`，输入 `branch`，默认 `main`
- CI/CD workflow:
  - `.github/workflows/docker-build.yaml` 构建并推送 GHCR 镜像
  - `.github/workflows/deploy.yml` 通过 SSH 部署到 Silicon 服务器
- Manual inputs:
  - `Deploy to Silicon` 的 `branch` 输入，默认 `main`
- Expected deployment duration:
  - 等待镜像构建和服务器部署两个 workflow 完成；具体耗时以 GitHub Actions 实际运行时间为准
- Concurrency:
  - `Deploy to Silicon` 使用 `silicon-deploy` concurrency group，`cancel-in-progress: false`

## Runtime Architecture

- Runtime units:
  - `gpt101`: Next.js Web 应用容器，容器内监听 `3000`
  - `gpt101-worker`: 后台 worker 容器，执行 `node worker.js`
  - `gpt101-postgres`: PostgreSQL 容器，使用 Docker volume 持久化数据
- Reverse proxy or edge layer:
  - 生产 compose 只把 Web 暴露到宿主机 `127.0.0.1:3001:3000`
  - 外部访问由 Silicon 服务器上的反向代理接入到本地端口
- Databases and persistent stores:
  - PostgreSQL，Docker volume: `gpt101_postgres_data`
  - 部署脚本不会自动执行数据库 migration
- Important runtime config:
  - `deploy/docker-compose.yml`
  - 服务器侧 `~/projects/gpt101/deploy/.env`，不入库
  - GHCR 镜像 tag 由 workflow 使用 `sha-<full-commit-sha>` 约定
- Runtime path:
  - GitHub Actions 部署脚本使用 `$HOME/projects/gpt101`
  - 部署目录为 `$HOME/projects/gpt101/deploy`

## Pre-Deploy Checks

发布前至少运行：

```bash
pnpm exec tsx --test tests/homepage/header-sign-entry.test.ts
pnpm exec prettier --check docs/deployment.md src/config/locale/messages/zh/landing.json src/config/locale/messages/en/landing.json tests/homepage/header-sign-entry.test.ts
git diff --check
pnpm build
```

如果本次发布涉及其他模块，必须补充对应测试。涉及 auth、payment、billing、permissions、database、migration、data deletion、routing、deploy scripts、rollback scripts、infrastructure 或 public API contracts 时，必须扩大验证范围，并在发布前判断中说明风险。

## Deployment-Critical Files

每次部署前必须读取：

- `README.md`
- `docs/deployment.md`
- `.github/workflows/docker-build.yaml`
- `.github/workflows/deploy.yml`
- `deploy/docker-compose.yml`
- `deploy/rollback.sh`

`docs/deploy-plan.md` 是历史方案说明，不是当前发布事实源；如果它与本文件或当前部署脚本冲突，以当前 workflow、compose、rollback 脚本和本文件为准。

## Backup Requirements

- Backup trigger:
  - `Deploy to Silicon` 在检测到正在运行的 `gpt101-postgres` 容器时，会在部署前执行 `pg_dump | gzip`
  - `deploy/rollback.sh backup-db` 和 `deploy/rollback.sh prep` 可手动创建备份
- Backup artifact:
  - `deploy/backups/pre-deploy-YYYYMMDD_HHMMSS.sql.gz`
- Backup location:
  - 服务器 `$HOME/projects/gpt101/deploy/backups/`
- Sanity check:
  - 部署脚本要求备份文件非空，并执行 `gzip -t`
- Retention:
  - 自动部署会删除 7 天以前的 `pre-deploy-*.sql.gz`
- What failure means:
  - 部署前数据库备份创建或校验失败时，生产部署必须停止
  - 首次部署且没有 `gpt101-postgres` 容器时，部署脚本会跳过备份

## Rollback and Recovery

- Fastest service recovery path:
  - SSH 到生产服务器，进入 `$HOME/projects/gpt101/deploy`
  - 执行 `./rollback.sh image`
  - 该命令默认使用 `gpt101:rollback-latest` 重启 `gpt101` 和 `gpt101-worker`
- Previous-version or artifact rollback path:
  - 部署脚本会在部署前把当前运行的 `gpt101` 容器镜像打为 `gpt101:rollback-YYYYMMDD_HHMMSS-<commit>` 和 `gpt101:rollback-latest`
  - 回滚元数据写入 `deploy/backups/last-rollback-image.txt`
  - `./rollback.sh source <commit>` 只能在确认对应 GHCR 镜像 tag 可用后使用；常规快速恢复优先用 `./rollback.sh image`
- Database restore path:
  - `./rollback.sh db-restore [backup-file] --with-image [tag]`
  - `./rollback.sh db-restore [backup-file] --with-source <commit>`
- Actions requiring explicit confirmation:
  - 数据库恢复
  - 破坏性 migration rollback
  - 数据删除
  - 环境重建
  - 凭据轮换
- Verification after recovery:
  - `docker compose ps`
  - `docker inspect` 确认 `gpt101` 和 `gpt101-postgres` 健康状态
  - `docker inspect` 确认 `gpt101-worker` 为 `running`
  - `curl -I https://gpt101.org/`
  - 检查 `docker logs --tail 200 gpt101` 和 `docker logs --tail 200 gpt101-worker`

## Monitoring During Deployment

- CI/CD status:
  - GitHub Actions: `Build and Push Docker Image`
  - GitHub Actions: `Deploy to Silicon`
  - 如本地已登录 `gh`，可用 `gh run list` 和 `gh run watch <run-id>` 观察
- Runtime version check on server:
  - `cd $HOME/projects/gpt101 && git rev-parse HEAD`
  - `docker inspect --format '{{.Config.Image}}' gpt101`
- Health checks on server:
  - `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' gpt101`
  - `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' gpt101-postgres`
  - `docker inspect --format '{{.State.Status}}' gpt101-worker`
  - `docker compose ps`
- External checks:
  - `curl -I https://gpt101.org/`
  - 对本次变更相关页面做实际页面检查
- Log checks:
  - `docker logs --tail 200 gpt101`
  - `docker logs --tail 200 gpt101-worker`
- Backup and rollback checks:
  - `ls -lh deploy/backups/pre-deploy-*.sql.gz | tail`
  - `gzip -t "$(ls -t deploy/backups/pre-deploy-*.sql.gz | head -1)"`
  - `cat deploy/backups/last-rollback-image.txt`

## Success Criteria

发布完成必须同时满足：

- 目标环境运行预期 commit 或镜像
- `Build and Push Docker Image` 成功
- `Deploy to Silicon` 成功
- 部署前备份存在且通过 `gzip -t`
- `deploy/backups/last-rollback-image.txt` 存在并指向可用回滚镜像
- `gpt101` 和 `gpt101-postgres` 健康检查通过
- `gpt101-worker` 为 `running`
- 外部访问 `https://gpt101.org/` 正常
- 本次变更相关业务检查通过

## Failure Handling

- Failure before live impact:
  - 停止发布，收集失败 workflow、失败步骤和日志
  - 如果是构建失败或部署前检查失败，不做生产恢复动作
- Failure after live impact:
  - 优先使用 `deploy/rollback.sh image` 恢复到最近一次部署前镜像
  - 恢复后重新执行运行态、日志、外部访问和业务检查
- When to stop and ask:
  - 需要数据库恢复、环境重建、数据删除、凭据轮换或破坏性 schema 操作时
- Evidence to collect:
  - GitHub Actions run id
  - 目标 commit
  - 运行容器镜像
  - 备份文件和 `gzip -t` 结果
  - `last-rollback-image.txt`
  - 健康检查、日志摘要和外部访问结果

## Post-Deploy Documentation

如果实际发布流程、命令、备份位置、回滚路径或成功标准与本文件不同，服务稳定后必须更新本文件。不要写入密钥、Token、密码、私钥或客户数据。
