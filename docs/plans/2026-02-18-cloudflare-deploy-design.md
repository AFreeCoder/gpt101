# GPT101 Cloudflare 部署设计

## 背景

GPT101.org 已从 Astro 迁移到 ShipAny（Next.js 16），代码位于 `apps/web-next/`。
现需将项目结构整理到根目录，并适配 Cloudflare Workers 部署。

参考：shipany-template 仓库 dev 分支（Vercel）vs cf 分支（Cloudflare）的差异。

## 方案选择

**方案 A（已选）**：先移到根目录，再做 CF 适配。
- 删除 Astro 遗留代码，将 `apps/web-next/` 移到根目录
- 参照 cf 分支做 Cloudflare 适配
- 回归测试

## 第一部分：项目结构重组

### 删除内容（Astro 遗留）

- `src/`（Astro 源码）
- `public/`（Astro 静态资源）
- `vendor/`（AstroWind 集成）
- `nginx/`（Nginx 配置）
- `astro.config.ts`
- `tailwind.config.js`（根目录）
- `tsconfig.json`（根目录）
- `Dockerfile`（根目录 Astro）
- `docker-compose.yml`
- `vercel.json`（根目录 Astro）
- `netlify.toml`
- `package.json`（根目录 Astro）
- `package-lock.json`
- `.github/workflows/actions.yaml`（Astro CI）
- `_index.astro.backup`

### 保留内容

- `docs/`（设计文档）
- `.git/`
- `.gitignore`（需更新）
- `CLAUDE.md`

### 移动操作

`apps/web-next/*` → 根目录 `/`

移动后根目录结构：

```
gpt101.org/
├── src/
├── content/
├── public/
├── docs/
├── scripts/
├── .github/workflows/
├── package.json
├── next.config.mjs
├── open-next.config.ts
├── wrangler.toml
├── Dockerfile
├── vercel.json
├── tsconfig.json
└── .gitignore
```

## 第二部分：Cloudflare 适配

### Next.js 降级 16 → 15.5.7

| 包 | 当前版本 | 目标版本 |
|---|---|---|
| next | 16.0.7 | 15.5.7 |
| @next/bundle-analyzer | 16.0.7 | ^15.5.7 |
| @next/third-parties | 16.0.7 | ^15.5.7 |
| eslint-config-next | 16.0.7 | 15.5.7 |

新增：`@opennextjs/cloudflare: ^1.10.1`

### 代码适配

1. **next.config.mjs**：添加 `initOpenNextCloudflareForDev()` 和 `serverExternalPackages`
2. **src/proxy.ts → src/middleware.ts**：Next.js 15 middleware 约定
3. **tsconfig.json**：`jsx: "react-jsx"` → `"preserve"`
4. **src/shared/models/config.ts**：`revalidateTag(tag, 'max')` → `revalidateTag(tag)`

### 新增文件

1. **open-next.config.ts**：OpenNext Cloudflare 配置
2. **wrangler.toml**：CF 部署配置（基于 example 创建）

### slug 路由兼容

`src/app/[locale]/(landing)/[...slug]/page.tsx`：移除 `@` 前缀过滤

### 数据库层

暂不需要——GPT101 当前不使用数据库。

## 第三部分：回归测试与 CI/CD

### 回归测试清单

| 测试项 | 方法 |
|---|---|
| 构建成功 | `pnpm build` |
| TypeScript 编译 | `pnpm tsc --noEmit` |
| 首页渲染 | 页面 + JSON-LD（WebSite + Service + FAQ） |
| 镜像页渲染 | 页面 + Service JSON-LD |
| 落地页渲染 | 页面 + Service + FAQ JSON-LD |
| 教程页渲染 | 列表和详情正常 |
| GA4 | 脚本加载 |
| Google Ads 转化追踪 | sendOutboundClick 事件 |
| 百度统计 | 脚本加载 |
| CF 预览 | `pnpm cf:preview` 本地 Workers |

### CI/CD 调整

- 保留 docker-build.yaml，移到根目录 `.github/workflows/`
- 删除 Astro CI actions.yaml
- 路径引用调整到根目录

### .gitignore 更新

合并两份 .gitignore，移除 `.astro`，添加 `.open-next`。
