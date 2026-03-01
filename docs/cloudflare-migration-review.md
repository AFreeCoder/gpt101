# Cloudflare Migration Review (feature/cloudflare-migration vs main)

## 审查结论

**结论：不通过（当前不建议直接上线）**

本次迁移代码在基础编译层面可通过，但存在 Cloudflare 部署阻塞项：仓库缺少 `wrangler.(toml|json|jsonc)`，导致 `opennextjs-cloudflare build` 无法在非交互环境完成。该问题会直接影响 CI/CD 自动部署。

## 审查范围与验证方式

- 对比分支：`main...feature/cloudflare-migration`
- 重点核查：
  - Next.js 降级到 `15.5.7`
  - `@opennextjs/cloudflare` 配置完整性
  - middleware 重命名逻辑完整性
  - Vercel 配置清理程度
  - 数据库适配改动安全性
- 实测命令：
  - `pnpm -s exec tsc --noEmit`（通过）
  - `pnpm -s build`（通过，Next.js 15.5.7）
  - `pnpm -s exec opennextjs-cloudflare build`（失败，因缺少 wrangler 配置进入交互提示）

---

## 1) 关键迁移点审查

### 1.1 Next.js 降级到 15.5.7

**结果：基本正确（通过）**

- `next` 已从 `16.0.7` 降级为 `15.5.7`（`package.json`）。
- `eslint-config-next` 已同步降级到 `15.5.7`。
- `@next/bundle-analyzer`、`@next/third-parties` 已同步到 `15.5.7` 范围。
- `@types/react-dom` 从 `19.2.2` 调整为 `19.2.1`，与现有 `react-dom@19.2.1` 对齐。
- 兼容性修正：`revalidateTag(tag, 'max')` 改为 `revalidateTag(tag)`，符合 Next 15 API 形式。

补充验证：`next build` 全量通过，说明降级后主流程未出现编译阻断。

### 1.2 `@opennextjs/cloudflare` 配置完整性

**结果：不通过（阻塞）**

已完成的部分：

- 已引入 `@opennextjs/cloudflare` 依赖与 `cf:*` 脚本。
- 已新增 `open-next.config.ts`。
- `next.config.mjs` 已在 dev 模式调用 `initOpenNextCloudflareForDev()`。

缺失/问题：

- 仓库内没有 `wrangler.toml` / `wrangler.json` / `wrangler.jsonc`。
- 实测 `opennextjs-cloudflare build` 直接提示：`No wrangler.(toml|json|jsonc) config file found`，并进入交互，非交互环境下失败退出。

这意味着迁移尚未形成“可自动化部署”的闭环。

### 1.3 middleware 重命名是否保留业务逻辑

**结果：通过**

- `src/proxy.ts` -> `src/middleware.ts` 为高相似度重命名（核心逻辑保持一致）。
- 仅将导出函数名 `proxy` 调整为 `middleware`，符合 Next.js 约定。
- 鉴权、i18n、公共页缓存头处理逻辑均保留。

结论：未发现业务鉴权/路由处理逻辑被误删。

### 1.4 Vercel 配置清理是否彻底

**结果：部分通过（有残留）**

已清理：

- 已删除 `vercel.json` 与 `.vercelignore`。

残留项：

- `next.config.mjs` 仍含 `process.env.VERCEL ? undefined : 'standalone'` 分支。
- middleware matcher 仍排除 `_vercel` 路径（`/((?!api|trpc|_next|_vercel|.*\\..*).*)`）。
- 代码中仍保留 `@vercel/analytics` 相关配置与扩展代码。

说明：这类残留多数不是“阻塞部署”的问题，但属于迁移后平台耦合残余，建议整理。

### 1.5 数据库适配改动是否安全（项目实际未使用 DB）

**结果：低影响通过（但需前置条件确认）**

- `src/core/db/postgres.ts` 在 Cloudflare Worker 分支中，已从空 env 占位切换为 `getCloudflareContext()` 读取 `env`，修复方向正确。
- 若后续启用 Hyperdrive，需要在 wrangler 配置中声明 `HYPERDRIVE` 绑定名，否则不会生效。
- 若当前部署确实不使用 DB（`DATABASE_URL` 为空），该改动运行时影响有限。

备注：仓库中仍有大量 DB 调用路径，所谓“未使用 DB”需以生产环境变量和实际功能开关为准。

---

## 2) 风险评估

### 2.1 业务定制代码是否被误删

**评估：未发现明显误删（低风险）**

- 业务相关变更基本集中在：
  - middleware 文件名与导出名
  - 少量注释调整
  - Next 15 兼容性 API 调整
- 未观察到核心业务流程代码块被删除。

### 2.2 环境变量依赖是否需要更新

**评估：需要更新（中高风险）**

- Cloudflare 侧需完整迁移原 Vercel 环境变量（包括生产密钥）。
- 若启用 Hyperdrive，需在 `wrangler` 配置中声明 `HYPERDRIVE` 绑定。
- `NEXT_PUBLIC_APP_URL` 需切换到 Cloudflare 实际域名。
- 如仍使用 `@vercel/analytics`，需确认跨平台采集策略是否符合预期。

### 2.3 部署后可能的兼容性问题

**评估：中风险（当前存在 1 个阻塞项）**

- 阻塞：缺少 `wrangler` 配置，OpenNext 无法直接非交互构建部署。
- 潜在：`output: 'standalone'` 与 OpenNext 构建路径建议做一次实测确认（当前 `next build` 通过，但 OpenNext 产物路径尚未完成闭环验证）。

---

## 高风险点清单

1. **[阻塞] 缺少 `wrangler` 配置文件，`opennextjs-cloudflare build` 无法在 CI 非交互执行。**
2. **[高] Cloudflare 环境变量/绑定尚未形成可追踪配置基线（至少未在仓库体现），容易导致部署后运行时缺参。**
3. **[中] 迁移后仍有 Vercel 平台残留（配置分支、analytics、matcher 关键词），增加维护歧义。**

---

## 部署前必做检查项

- [ ] 在仓库新增并提交 `wrangler.toml`（或 `wrangler.jsonc`），完成 `name`、`main`、`compatibility_date`、`compatibility_flags`、`vars`、`bindings` 等最小可部署配置。
- [ ] 在 Cloudflare 中配置并核对全部运行时 Secrets/Vars（对齐原 Vercel 生产值）。
- [ ] 若使用 Hyperdrive：在 `wrangler` 中声明 `HYPERDRIVE` 绑定，并验证 `getCloudflareContext().env.HYPERDRIVE` 可读。
- [ ] 本地/CI 执行并通过：`pnpm cf:typegen`、`pnpm cf:preview`、`pnpm cf:deploy`（至少 preview 成功一次）。
- [ ] 逐项验证 middleware 行为：
  - [ ] 未登录访问 `/admin|/settings|/activity` 正确重定向登录
  - [ ] 多语言路径回调参数 `callbackUrl` 正确
  - [ ] 公共页面缓存头行为符合预期
- [ ] 决策并清理 Vercel 残留：
  - [ ] 是否继续使用 `@vercel/analytics`
  - [ ] 是否保留 `_vercel` matcher 排除
  - [ ] 是否保留 `process.env.VERCEL` 分支逻辑

---

## 结论摘要

本分支已经完成“从代码可编译角度”的主要迁移动作，但尚未完成“可自动化部署到 Cloudflare”的最后闭环。当前最关键阻塞是 `wrangler` 配置缺失，因此本次审查结论为 **不通过**，建议补齐上述必做项后再复审。
