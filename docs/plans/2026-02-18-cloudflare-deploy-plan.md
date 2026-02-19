# GPT101 Cloudflare 部署实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 GPT101 项目从 `apps/web-next/` 移到根目录，适配 Cloudflare Workers 部署，并通过回归测试。

**Architecture:** 删除 Astro 遗留代码 → 移动 Next.js 项目到根目录 → Next.js 16 降级到 15.5.7 → 添加 OpenNext Cloudflare 适配 → 回归测试。

**Tech Stack:** Next.js 15.5.7, @opennextjs/cloudflare, pnpm, Wrangler

---

### Task 1: 删除 Astro 遗留文件

**Files:**
- Delete: `src/` (Astro 源码目录)
- Delete: `public/` (Astro 静态资源)
- Delete: `vendor/` (AstroWind 集成)
- Delete: `nginx/` (Nginx 配置)
- Delete: `astro.config.ts`
- Delete: `tailwind.config.js` (根目录)
- Delete: `tsconfig.json` (根目录)
- Delete: `Dockerfile` (根目录 Astro)
- Delete: `docker-compose.yml`
- Delete: `vercel.json` (根目录 Astro)
- Delete: `netlify.toml`
- Delete: `package.json` (根目录 Astro)
- Delete: `package-lock.json`
- Delete: `_index.astro.backup`
- Delete: `.github/workflows/actions.yaml` (Astro CI)
- Delete: `eslint.config.js` (根目录)
- Delete: `sandbox.config.json`
- Delete: `.npmrc`
- Delete: `.prettierignore` (根目录)
- Delete: `.prettierrc.cjs` (根目录)
- Delete: `.stackblitzrc`
- Delete: `.editorconfig`
- Delete: `.dockerignore` (根目录)
- Delete: `CONFIGURATION.md`
- Delete: `LICENSE.md` (根目录，web-next 有自己的)
- Delete: `README.md` (根目录)

**Step 1: 删除 Astro 遗留文件**

```bash
cd /Users/afreecoder/project/gpt101.org
git rm -r src/ public/ vendor/ nginx/
git rm astro.config.ts tailwind.config.js tsconfig.json Dockerfile docker-compose.yml
git rm vercel.json netlify.toml package.json package-lock.json
git rm _index.astro.backup eslint.config.js sandbox.config.json
git rm .npmrc .prettierignore .prettierrc.cjs .stackblitzrc .editorconfig .dockerignore
git rm CONFIGURATION.md LICENSE.md README.md
git rm .github/workflows/actions.yaml
```

Expected: 所有 Astro 相关文件从 git 追踪中移除。

**Step 2: 提交**

```bash
git commit -m "refactor: 删除 Astro 遗留文件"
```

---

### Task 2: 移动 Next.js 项目到根目录

**Step 1: 移动 apps/web-next 下所有文件（含隐藏文件）到根目录**

```bash
# 先移动非隐藏文件/目录
git mv apps/web-next/content .
git mv apps/web-next/scripts .
git mv apps/web-next/src .
git mv apps/web-next/public .
git mv apps/web-next/next.config.mjs .
git mv apps/web-next/package.json .
git mv apps/web-next/tsconfig.json .
git mv apps/web-next/Dockerfile .
git mv apps/web-next/vercel.json .
git mv apps/web-next/postcss.config.mjs .
git mv apps/web-next/source.config.ts .
git mv apps/web-next/components.json .
git mv apps/web-next/wrangler.toml.example .
git mv apps/web-next/LICENSE .

# 隐藏文件
git mv apps/web-next/.prettierignore .
git mv apps/web-next/.prettierrc.json .
git mv apps/web-next/.vercelignore .
git mv apps/web-next/.dockerignore .
git mv apps/web-next/.env.example .

# .github 目录（合并到已有的 .github/）
git mv apps/web-next/.github/workflows/docker-build.yaml .github/workflows/docker-build.yaml

# .vscode 目录（覆盖根目录的）
# 先检查根目录是否有 .vscode，用 cp + rm 方式
```

注意：
- `pnpm-lock.yaml` 已在 `.gitignore` 中，手动复制
- `.env` 已在 `.gitignore` 中，手动复制
- `.dev.vars` 已在 `.gitignore` 中，手动复制
- `node_modules/`、`.next/`、`.source/` 不需要移动
- `.gitignore` 需要用 web-next 的替换根目录的

**Step 2: 替换 .gitignore**

用 `apps/web-next/.gitignore` 的内容替换根目录 `.gitignore`，并追加保留 `shipany-template/` 和 `seo/` 排除项。

```
# 在 apps/web-next/.gitignore 基础上追加：

# ShipAny 原始模板（仅本地参考）
shipany-template/

# SEO 文档
seo/
```

**Step 3: 复制非 git 追踪的文件**

```bash
cp apps/web-next/pnpm-lock.yaml .
cp apps/web-next/.env .
cp apps/web-next/.dev.vars . 2>/dev/null || true
```

**Step 4: 删除空的 apps/ 目录**

```bash
git rm -r apps/  # 清理残留的 tracked 文件
rm -rf apps/     # 清理 untracked 文件
```

**Step 5: 提交**

```bash
git commit -m "refactor: 将 Next.js 项目从 apps/web-next 移到根目录"
```

---

### Task 3: 安装依赖并验证移动成功

**Step 1: 安装依赖**

```bash
pnpm install
```

Expected: 安装成功。

**Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

**Step 3: 构建验证**

```bash
pnpm build
```

Expected: 构建成功（MDX 远程图片超时是网络问题，不影响）。

**Step 4: 提交 lockfile 变更（如有）**

如果 pnpm-lock.yaml 有变更（不在 gitignore 中了），提交之。

---

### Task 4: Next.js 16 → 15.5.7 降级

**Files:**
- Modify: `package.json`

**Step 1: 修改 package.json 中的版本号**

```bash
pnpm add next@15.5.7 @next/bundle-analyzer@15.5.7 @next/third-parties@15.5.7
pnpm add -D eslint-config-next@15.5.7
```

**Step 2: 添加 @opennextjs/cloudflare**

```bash
pnpm add @opennextjs/cloudflare@^1.10.1
```

**Step 3: 重新安装依赖**

```bash
pnpm install
```

Expected: 安装成功，无冲突。

**Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "refactor: Next.js 16 降级到 15.5.7，添加 @opennextjs/cloudflare"
```

---

### Task 5: Cloudflare 代码适配

**Files:**
- Modify: `next.config.mjs` — 添加 initOpenNextCloudflareForDev + serverExternalPackages
- Rename: `src/proxy.ts` → `src/middleware.ts`，函数名 `proxy` → `middleware`
- Modify: `tsconfig.json` — jsx: "react-jsx" → "preserve"
- Modify: `src/shared/models/config.ts` — revalidateTag 移除第二参数
- Modify: `src/app/[locale]/(landing)/[...slug]/page.tsx` — 移除 @ 前缀过滤

**Step 1: 修改 next.config.mjs**

在文件顶部 import 区域添加：
```javascript
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
```

在 nextConfig 对象中添加 `serverExternalPackages`：
```javascript
serverExternalPackages: ['@libsql/client', '@libsql/isomorphic-ws'],
```

在文件末尾（export 之后）添加：
```javascript
initOpenNextCloudflareForDev();
```

**Step 2: 重命名 src/proxy.ts → src/middleware.ts**

```bash
git mv src/proxy.ts src/middleware.ts
```

然后将文件中 `export async function proxy(` 改为 `export async function middleware(`。

**Step 3: 修改 tsconfig.json**

将 `"jsx": "react-jsx"` 改为 `"jsx": "preserve"`。

**Step 4: 修改 src/shared/models/config.ts**

将两处 `revalidateTag(CACHE_TAG_CONFIGS, 'max')` 改为 `revalidateTag(CACHE_TAG_CONFIGS)`。

**Step 5: 修改 src/app/[locale]/(landing)/[...slug]/page.tsx**

将两处：
```typescript
if (staticPageSlug.includes('.') || staticPageSlug.startsWith('@')) {
```
改为：
```typescript
if (staticPageSlug.includes('.')) {
```

**Step 6: 提交**

```bash
git add -A
git commit -m "refactor: Cloudflare Workers 代码适配（middleware、config、tsconfig）"
```

---

### Task 6: 添加 OpenNext 配置文件

**Files:**
- Create: `open-next.config.ts`

**Step 1: 创建 open-next.config.ts**

```typescript
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // Uncomment to enable R2 cache,
  // It should be imported as:
  // `import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";`
  // See https://opennext.js.org/cloudflare/caching for more details
  // incrementalCache: r2IncrementalCache,
});
```

**Step 2: 提交**

```bash
git add open-next.config.ts
git commit -m "feat: 添加 OpenNext Cloudflare 配置"
```

---

### Task 7: 更新 .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: 确认 .gitignore 包含以下 CF 相关条目**

确保包含（来自 web-next 的 .gitignore）：
```
.open-next
wrangler.toml
.wrangler
src/shared/types/cloudflare.d.ts
```

以及从根目录旧 .gitignore 保留的：
```
shipany-template/
seo/
```

**Step 2: 提交**

```bash
git add .gitignore
git commit -m "chore: 更新 .gitignore（合并 Astro + Next.js + CF 规则）"
```

---

### Task 8: 回归测试 — 构建与类型检查

**Step 1: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。

**Step 2: 构建验证**

```bash
pnpm build
```

Expected: 构建成功。

---

### Task 9: 回归测试 — 页面渲染与功能验证

**Step 1: 启动 dev server**

```bash
pnpm dev
```

等待编译完成。

**Step 2: 验证首页**

```bash
curl -s http://localhost:3000 | grep -c 'application/ld+json'
```

Expected: 3（WebSite + Service + FAQPage）

**Step 3: 验证镜像页**

```bash
curl -s http://localhost:3000/chatgpt-mirror | grep -c 'application/ld+json'
```

Expected: 1（Service）

**Step 4: 验证落地页**

```bash
curl -s http://localhost:3000/lp/g/upgrade-chatgpt | grep -c 'application/ld+json'
```

Expected: 2（Service + FAQPage）

**Step 5: 验证教程页**

```bash
curl -s http://localhost:3000/tutorials | grep -c '教程'
```

Expected: >= 1

**Step 6: 验证统计代码**

```bash
# GA4
curl -s http://localhost:3000 | grep -c 'G-KPY9887M4F'
# 百度统计
curl -s http://localhost:3000 | grep -c '35999906c23d844610453823877173a8'
# Google Ads
curl -s http://localhost:3000 | grep -c 'AW-17885221737'
```

Expected: 每个 >= 1。

---

### Task 10: Cloudflare 预览测试

**Step 1: 运行 CF 预览构建**

```bash
pnpm cf:preview
```

Expected: OpenNext 构建成功，本地 Workers 预览可访问。

**Step 2: 验证 CF 预览中的页面**

访问 Workers 预览地址，检查首页、镜像页、落地页是否正常渲染。

**Step 3: 提交所有剩余变更（如有）**

```bash
git status
# 如有未提交的变更，提交之
```
