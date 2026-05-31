# /channel-upgrade 视觉换肤设计稿（D3 琥珀金）

- 日期：2026-06-01
- 分支：`channel-upgrade-reskin`
- 状态：待用户评审

## 1. 背景与目标

`/channel-upgrade` 与 `/upgrade` 当前渲染同一个共享组件 `UpgradeFlow`，视觉 100% 一致。
本次目标：为 `/channel-upgrade` 单独设计一套视觉皮肤 + 局部文案/布局微调，使其
**与 `/upgrade`、以及站点整体主色（蓝 / 绿 / 紫蓝）都明显区分**，同时：

- **不改动 `/upgrade` 的任何视觉与行为**（逐字保持现状）。
- 不改动升级业务逻辑、API、埋点、状态轮询等。
- 整体交互流程保持不变，仅做局部布局优化。

## 2. 范围

| 改 | 不改 |
| --- | --- |
| `/channel-upgrade` 主页视觉、文案、布局、动效 | `/upgrade` 全部（默认分支逐字不变） |
| `/channel-upgrade` 状态页（UpgradeStatusView）视觉 | `/[locale]/(agent-upgrade)` 等其它入口 |
| 升级须知弹窗（Notice Dialog）视觉 | 卡密校验 / Token 解析 / 提交 / 轮询等业务逻辑 |
| 新增作用域样式文件 + 组件 `variant` 分支 | API 路由、埋点、`noticeConfig` 数据来源 |

## 3. 视觉系统（D3 琥珀金 · 浅色清新）

### 3.1 颜色 token（hex，实现时接入作用域 CSS 变量）

| 角色 | 值 | 用途 |
| --- | --- | --- |
| `--background` | `#FDFAF2` | 页面暖白底（含顶部金色极淡光晕） |
| `--card` | `#FFFFFF` | 卡片背景 |
| `--foreground` | `#2A2316` | 主文字 |
| `--muted-foreground` | `#897F66` | 次要文字 |
| `--primary` | `#C77C12` | 主色琥珀金（操作 / 激活 / 进行中） |
| `--primary-foreground` | `#FFFFFF` | 金色按钮上的文字 |
| primary-soft | `#FBF1DC` | 主色浅底（kicker/徽章软背景、弹窗头部） |
| `--border` | `#EFE6CF` | 边框 |
| success | `#B45309` + ✓ | 成功（深金，**不用绿**，避开站点绿） |
| warning/risk | 文字 `#9A3412` / 底 `#FBF3EC` / 边 `#F0DBCB` | 警告/风险（赤褐，与主色金区分） |
| error | `#DC2626` | 错误（红） |

> 站点 landing 主色统计：`blue-600/700` 最多，其次 `green/emerald`，再紫蓝（theme 主色）、少量 amber 点缀。
> 本方案主色金 + 暖白底 + 赤褐警告 + 红错误，均避开蓝 / 绿 / 紫，确保不与站点撞色。

### 3.2 字体

- 正文与标题统一使用 **Manrope**（圆润现代无衬线），与 `/upgrade` 的 Noto Sans Mono（等宽）形成对比。
- 通过 `next/font` 引入 Manrope 并暴露一个 CSS 变量，仅在 `.channel-skin` 作用域内引用，不影响全站其它页面。

### 3.3 尺寸 / 圆角

- 大圆角现代感：卡片 `16px`、按钮/输入框 `12px`、徽章 `~11px`、进度圆点/胶囊 `full`。
- 标题字号 `34px / 800`，副标 `14px`。

## 4. 文案改动

1. 主标题：`GPT 会员升级` → **`GPT Plus 自助升级`**
2. 删除标题上方的 kicker 小胶囊（原"自助升级服务"）。
3. 删除顶部常驻的"邮箱风险提示"条
   - 理由：Step2 核验 Token 检测到 outlook/hotmail 邮箱时本就会出现专门提示，无需顶部重复。
4. 副标保留：`全自动处理，通常 1-2 分钟完成升级`。
5. 安全保障文案沿用现有（`数据加密传输` / `通常 1-2 分钟完成` / `异常请联系购卡渠道处理`）。

## 5. 布局改动（单栏化）

`/channel-upgrade` 从「左步骤 + 右信息栏」双栏改为**单栏**（居中，约 `max-w` 720px）：

1. 标题区（无 kicker，新标题 + 副标，居中）。
2. **顶部横向进度条**：`① 核验卡密 — ② 核验 Token — ③ 确认升级`，当前步金色脉冲、已完成 ✓、未来灰。
   - 取代原右侧竖排"升级流程"（与步骤卡片内容重复，已用户确认改为横向进度条）。
3. 三个步骤卡片（**完全复用**现有 Step1/2/3 的内部内容与逻辑，仅去掉右侧栏包裹）。
4. 确认升级按钮。
5. **底部安全保障行**：原右侧栏的"数据加密传输 / 1-2 分钟 / 异常处理"移到此处，居中横排。

> `/upgrade` 仍保持原双栏 + kicker + 风险条 + 右侧栏，完全不变。

## 6. 动效（尊重 `prefers-reduced-motion`，整体克制）

- 首屏入场：标题、进度条、各卡片 staggered fade-up。
- 当前进度圆点：轻微脉冲。
- 按钮 hover：上浮 + 暖金阴影；active：微缩。
- 输入框 focus：金色聚焦环。
- 卡密有效 / Token 通过：`✓` 提示 pop-in 弹入。
- 卡片激活切换：border / shadow 过渡。
- 提交中 / 轮询：金色 spinner；升级成功：成功图标 pop-in。

## 7. 升级须知弹窗（Notice Dialog）

原 amber 浅黄头部 + 绿色确认按钮 → D3 版：

- 暖白卡片、大圆角、Manrope。
- 头部 primary-soft 金色软底 + 金色标题。
- 须知项编号用金色小块。
- 底部金色"我已了解，继续升级"按钮（hover 上浮）。
- 弹出时轻微缩放渐入。
- 内容仍由后台 `noticeConfig` 驱动，仅换视觉。
- 弹窗经 portal 渲染（在作用域容器之外），实现时需在 `DialogContent` 上直接挂 `.channel-skin` 类使作用域变量生效。

## 8. 状态页（UpgradeStatusView）

`/channel-upgrade/status/[taskNo]` 同步 D3 化：暖白卡片、金色 CTA/spinner、状态色与主题协调（成功用金、不用绿），保持原结构。

## 9. 技术实现方案

### 9.1 推荐方案：CSS 作用域 + 组件 `variant`

- **新增 `src/config/style/channel-skin.css`**：定义 `.channel-skin` 作用域内的全套 D3 语义变量（background / card / foreground / muted / primary / border / ring / radius + 字体），并提供页面暖白底 + 顶部金色光晕。`/channel-upgrade` 页面外层套 `<div class="channel-skin">`。
- **`UpgradeFlow` 增加 `variant?: 'default' | 'channel'`**：
  - `default` 分支：现有 JSX **逐字保持不变**（保护 `/upgrade`）。
  - `channel` 分支：删 kicker / 改标题 / 删风险条 / 加顶部横向进度条 / 单栏 / 删右侧栏 / 安全保障移底 / 启用动效类。
  - 三个步骤卡片的**内部内容与状态逻辑完全复用**，不重写。
  - 硬编码语义色（`emerald` 成功、`amber` 警告、`destructive` 错误）在 `channel` 下通过条件类切换为金 / 赤褐 / 红（沿用上次 `successCtaColor` 式的集中常量做法，避免散改）。
- **`UpgradeStatusView` 增加 `variant`**：同上，`default` 不变。
- **Notice Dialog**：`channel` 下给 `DialogContent` 追加 `.channel-skin` 类 + 语义色金化。
- **页面接线**：`channel-upgrade/page.tsx`、`channel-upgrade/status/[taskNo]/page.tsx` 套 `.channel-skin` 容器并传 `variant="channel"`；现有 props（`showSupportCard={false}`、`supportContact={null}` 等）保持不变。
- **字体**：`layout.tsx` 增加 Manrope（`next/font`）变量，仅 `.channel-skin` 引用。

### 9.2 备选方案：抽 hook + 独立组件（不采用）

将业务逻辑抽成 `useUpgradeFlow` hook，`channel` 用独立展示组件。布局更自由，但需重构 1115 行复杂业务逻辑，风险与工作量大。本次布局差异本质是「在复用的步骤卡片周围增删元素 + 换肤」，方案 9.1 已足够，故不采用。

### 9.3 「零侵入 /upgrade」保证

- 所有 `channel` 行为均由 `variant` 门控，`default` 代码路径逐字不变。
- 配色 / 字体仅在 `.channel-skin` 作用域内生效，不触及全局或 `/upgrade`。
- 须遵守现有测试约束（`reseller-upgrade-entry.test.ts`）：`channel-upgrade` 源码 **不得**出现 `presentation="channel"`、`headingKicker/headingTitle`、`卡密兑换服务台`、`PARTNER SERVICE DESK`、`AFreeCoder01`、`Footer/Header/TopBanner` 等被 `doesNotMatch` 的标记，且须保留 `showSupportCard={false}`、`supportContact={null}`。

## 10. 验证

- `/upgrade` 视觉回归：截图对比，确认与改动前完全一致。
- 现有测试全过：`reseller-upgrade-entry`、`upgrade-notice-dialog`、`upgrade-ad-funnel`、`upgrade-outlook-warning`、`upgrade-public-cardkey-ui` 等。
- `tsc --noEmit` 对改动文件零错误。
- 本地 dev server 真实渲染 `/channel-upgrade` 截图确认 D3 效果。
- 验证 `prefers-reduced-motion` 下动效降级。

## 11. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| `upgrade-flow.tsx` 复杂度上升 | `channel` 分支结构清晰、复用步骤卡片；`default` 路径不动 |
| 硬编码语义色（emerald/amber）遗漏 | 列出全部出现处，集中常量逐一 `variant` 化 |
| 误伤现有测试断言 | 保留 Notice Dialog 布局类、遵守 `reseller` 测试禁用 token |
| Manrope 字体加载影响 | 仅 `.channel-skin` 引用，`next/font` 本地化、`display:swap` |
