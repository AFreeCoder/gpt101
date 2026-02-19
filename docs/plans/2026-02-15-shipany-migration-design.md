# GPT101.org 迁移到 ShipAny Template 设计方案

**日期**：2026-02-15
**方案**：方案 A — 基于 shipany-template 裁剪

---

## 一、迁移总原则

- 以 shipany-template 为基础项目
- gpt101 所有页面用 React + shadcn/ui 重写
- shipany 的高级功能（认证、支付、AI、RBAC 等）**保留代码，隐藏入口**
- GA4 + Google Ads + 百度统计全部保留，百度统计自定义接入
- 博客内容迁移到 Fumadocs MDX 格式

### 分阶段计划

1. **第一阶段（本次迁移）**：把 gpt101.org 从 Astro 迁移到 shipany-template 框架，保持现有功能
2. **第二阶段（后续改造）**：升级流程自研实现，替代 987ai/9977ai 的 iframe
3. **第三阶段（远期）**：卡密购买接入自有支付，替代 dtyuedan

---

## 二、技术栈变化

| 维度 | 当前 (Astro) | 目标 (shipany) |
|------|-------------|---------------|
| **框架** | Astro 5 (SSG 静态) | Next.js 16 (SSR/SSG) |
| **UI** | Tailwind CSS 原生 | shadcn/ui + Radix + Tailwind 4 |
| **状态** | 无（纯静态） | React Context + Hooks |
| **国际化** | 无（硬编码中文） | next-intl（中/英） |
| **认证** | 无 | Better Auth（保留代码，隐藏入口） |
| **数据库** | 无 | Drizzle ORM（保留代码，隐藏入口） |
| **支付** | 第三方 iframe 嵌入 | 保留 iframe + shipany 原生支付框架隐藏 |
| **内容** | Astro Content Collections + MDX | Fumadocs MDX |
| **部署** | 静态文件（Vercel/Netlify/Docker） | Vercel/Cloudflare/Docker |

---

## 三、全局要素迁移（第一阶段）

| 要素 | 当前 (Astro) | 目标 (shipany) | 迁移方式 |
|------|-------------|---------------|---------|
| **站点配置** | `src/config/site.ts` + `config.yaml` | `src/config/index.ts` + i18n JSON | 配置项映射到 shipany 的配置体系 |
| **Header 导航** | Astro 组件 4 个入口 | shipany Header + i18n 导航配置 | 修改 `landing.json` 导航数据 |
| **Footer** | 6 列页脚 | shipany Footer + i18n 配置 | 修改 footer 翻译数据 |
| **主题** | 仅 light 模式 | shipany 主题系统，默认 light | 配置 `next-themes` 默认值 |
| **国际化** | 无（硬编码中文） | next-intl，默认中文，保留英文能力 | 将所有文案写入 `zh/*.json` |
| **SEO** | `@astrolib/seo` + JSON-LD | shipany SEO 工具 + Next.js Metadata | 迁移 meta/OG/结构化数据 |
| **分析** | GA4 + Google Ads + 百度统计 | shipany analytics 扩展 + 自定义百度 | GA4 用 shipany 扩展，百度自定义 Script |
| **静态资源** | `public/` 图标、二维码 | `public/` 直接复制 | 直接复制 |
| **悬浮客服** | 自定义 FloatingCustomerService | React 重写 | 用 shadcn/ui 重写组件 |

---

## 四、页面迁移清单（第二阶段）

按优先级排序，逐页迁移：

### 4.1 首页 `/`

**当前元素**：
- AnnouncementBanner（公告条幅）
- Hero（标题 + CTA 按钮）
- HeroSideAds（左右侧广告位：Claude Pro、API 服务）
- PurchaseChannelModal（7 渠道选择弹窗）
- 好评轮播（客户截图自动滚动 34s/40s）
- FAQs（7 个常见问题）
- CustomerSupport（客服卡片 + QQ 二维码）

**迁移方式**：在 shipany 的 `(landing)/page.tsx` 中用 React 重写所有组件，业务数据放入 i18n JSON

### 4.2 镜像服务页 `/chatgpt-mirror`

**当前元素**：
- 打字机效果标题
- ServiceComparison（Plus 代充 vs 镜像服务对比表）
- ServiceDetails（使用步骤 3 步指引）
- 客服支持

**迁移方式**：新建 `(landing)/chatgpt-mirror/page.tsx`

### 4.3 充值渠道页（5 个）

- `/gpt-upgrade-987ai`
- `/gpt-upgrade-9977ai`
- `/gpt-upgrade-xiaobei`
- `/gpt-upgrade-scgpt`
- `/lp/g/upgrade-chatgpt`

**迁移方式**：iframe 嵌入页，创建通用 `UpgradeChannel` 组件，5 个页面共用，通过配置区分

### 4.4 卡密购买页（2 个）

- `/qf-dtyuedan-buy`
- `/qf-dtyuedan-mirror-buy`

**迁移方式**：iframe 嵌入页，创建通用 `CardPurchase` 组件

### 4.5 维护页 `/chatgpt-plus-maintenance`

**迁移方式**：简单静态页，直接重写

### 4.6 博客系统

- `/tutorials` → 博客列表
- `/tutorials/[slug]` → 文章详情
- `/category/[category]` → 分类页
- `/tag/[tag]` → 标签页

**迁移方式**：使用 shipany 的 Fumadocs 博客系统，3 篇 MDX 文章转换格式后放入 `content/posts/`

**现有文章**：
1. `how-to-upgrade-gpt-plus.mdx` — GPT Plus 充值教程
2. `chatgpt-mirror-guide.mdx` — 镜像服务使用指南
3. `2025-latest-7-way-to-upgrade-chatgpt-plus.mdx` — 最新 7 种充值方式

### 4.7 404 页面

**迁移方式**：使用 shipany 的 `not-found.tsx`

### 4.8 落地页 `/lp/g/upgrade-chatgpt`

**迁移方式**：新建 `(landing)/lp/g/upgrade-chatgpt/page.tsx`

---

## 五、隐藏入口处理

以下 shipany 功能保留代码，但从导航/路由中隐藏：

| 功能 | 隐藏方式 |
|------|---------|
| 认证（登录/注册） | 从 Header 移除登录按钮，保留 `(auth)` 路由代码 |
| 管理后台 | 从导航移除入口，保留 `(admin)` 路由代码 |
| AI 生成器 | 从导航移除，保留 `(ai)` 路由代码 |
| 对话系统 | 从导航移除，保留 `(chat)` 路由代码 |
| 用户设置 | 从导航移除，保留 `settings` 路由代码 |
| 原生支付（Stripe/PayPal） | 不配置密钥即可，保留 `extensions/payment` 代码 |
| 文档系统 | 从导航移除，保留 `(docs)` 路由代码 |

---

## 六、数据配置映射

| gpt101 配置项 | shipany 对应位置 |
|--------------|----------------|
| `siteConfig.homepage.hero` | `zh/pages/index.json` → hero 部分 |
| `siteConfig.homepage.purchaseChannels` | `zh/pages/index.json` → 自定义字段 |
| `siteConfig.homepage.ads` | `zh/pages/index.json` → 自定义字段 |
| `siteConfig.mirrorPage` | `zh/pages/chatgpt-mirror.json` |
| `siteConfig.pricing` | `zh/common.json` → pricing |
| `siteConfig.contact` | `zh/common.json` → contact |
| `siteConfig.announcements` | `zh/common.json` → announcements |
| `siteConfig.analytics` | `.env` 环境变量 |
| `siteConfig.navigation` | `zh/landing.json` → header/footer |

---

## 七、新增自定义组件清单

需要用 React + shadcn/ui 重写的 gpt101 特有组件：

| 组件 | 来源 | 说明 |
|------|------|------|
| `AnnouncementBanner` | `widgets/AnnouncementBanner.astro` | 顶部公告条幅，可关闭 |
| `HeroSideAds` | `widgets/HeroSideAds.astro` | Hero 两侧广告位 |
| `PurchaseChannelModal` | `widgets/PurchaseChannelModal.astro` | 7 渠道选择弹窗 |
| `ReviewCarousel` | 首页好评轮播 | 客户截图自动滚动 |
| `ServiceComparison` | `widgets/ServiceComparison.astro` | Plus vs 镜像对比表 |
| `ServiceDetails` | `widgets/ServiceDetails.astro` | 充值步骤指引 |
| `FloatingCustomerService` | `widgets/FloatingCustomerService.astro` | 右下角悬浮客服按钮 |
| `CustomerSupport` | `widgets/CustomerSupport.astro` | 客服卡片 + QQ 二维码 |
| `TypewriterTitle` | 镜像页打字机效果 | 标题逐字显示 |
| `UpgradeChannel` | 新建通用组件 | iframe 嵌入升级渠道页 |
| `CardPurchase` | 新建通用组件 | iframe 嵌入卡密购买页 |

---

## 八、分析集成方案

### 8.1 Google Analytics 4
- **ID**：`G-KPY9887M4F`
- **接入方式**：使用 shipany 的 `extensions/analytics/google-analytics.tsx`
- **配置**：`.env` 中设置 `GOOGLE_ANALYTICS_ID`

### 8.2 Google Ads
- **ID**：`AW-17885221737`
- **接入方式**：在 shipany 的分析扩展中增加 Google Ads 支持，或在 layout 中自定义 Script
- **功能**：转化跟踪 + gtag 初始化

### 8.3 百度统计
- **ID**：`35999906c23d844610453823877173a8`
- **接入方式**：自定义 Script 组件，在 `(landing)/layout.tsx` 中注入
- **原因**：shipany 不原生支持百度统计

---

## 九、SEO 迁移

### 9.1 元数据
| 字段 | 值 |
|------|-----|
| 站点名 | GPT101 |
| 默认标题 | GPT101 - 一站式 GPT 充值服务 |
| 描述 | GPT Plus 代充和 GPT 镜像服务... |
| OG Image | 1200x628 预览图 |
| Twitter Handle | @arthelokyo |

### 9.2 结构化数据
- 产品 Schema（GPT Plus 代充服务）
- FAQ Schema（首页常见问题）
- HowTo Schema（充值教程文章）
- 使用 Next.js Metadata API + JSON-LD 实现

### 9.3 其他
- `sitemap.xml` — Next.js 自动生成
- `robots.txt` — Next.js 配置
- RSS — 需要自定义实现或使用 Fumadocs 的 RSS 支持

---

## 十、迁移执行顺序

### 阶段 1：全局要素（预计 1-2 天）
1. 复制 shipany-template 作为新项目基础
2. 配置 `.env`（站点名、分析 ID 等）
3. 修改 i18n 翻译文件（导航、页脚、通用文案）
4. 配置主题（默认 light 模式）
5. 复制静态资源（图标、二维码、图片）
6. 隐藏不需要的功能入口（从导航移除）
7. 接入 GA4 + Google Ads + 百度统计

### 阶段 2：首页迁移
8. 重写 Hero 组件
9. 重写 AnnouncementBanner
10. 重写 HeroSideAds
11. 重写 PurchaseChannelModal
12. 重写好评轮播
13. 重写 FAQs
14. 重写 CustomerSupport + FloatingCustomerService

### 阶段 3：镜像服务页
15. 重写打字机效果标题
16. 重写 ServiceComparison
17. 重写 ServiceDetails

### 阶段 4：充值/购买页面
18. 创建通用 UpgradeChannel 组件
19. 创建 5 个充值渠道页面
20. 创建通用 CardPurchase 组件
21. 创建 2 个卡密购买页面
22. 创建维护页

### 阶段 5：博客系统
23. 转换 3 篇 MDX 文章到 Fumadocs 格式
24. 配置博客路由（/tutorials）
25. 配置分类和标签页

### 阶段 6：SEO 和收尾
26. 配置 Next.js Metadata（OG、Twitter Card）
27. 添加结构化数据（JSON-LD）
28. 配置 sitemap 和 robots.txt
29. 配置 404 页面
30. 全面测试和调整

---

## 十一、风险和注意事项

1. **URL 变化**：确保所有现有 URL 在新站点上保持一致，必要时配置重定向
2. **iframe 兼容性**：第三方 iframe 在 Next.js 中的加载行为可能不同，需要测试
3. **SEO 影响**：框架切换可能导致短期 SEO 波动，确保 meta 数据完整迁移
4. **性能**：Astro SSG 生成的静态页面加载极快，Next.js 需要配置合理的缓存策略
5. **百度统计**：自定义接入需要确保与 Next.js 的客户端路由兼容（SPA 路由变化时需手动上报）
6. **好评轮播图片**：确保所有客户截图图片正确迁移
7. **QQ 二维码**：确保二维码图片路径正确

---

## 十二、成功标准

- [ ] 所有现有页面在新框架下正常运行
- [ ] 所有 URL 路径保持一致
- [ ] SEO 元数据完整迁移
- [ ] GA4 + Google Ads + 百度统计正常工作
- [ ] 购买渠道弹窗和 iframe 嵌入正常
- [ ] 博客文章正确显示
- [ ] 悬浮客服功能正常
- [ ] 移动端响应式正常
- [ ] shipany 隐藏功能的代码完整保留，可随时启用
