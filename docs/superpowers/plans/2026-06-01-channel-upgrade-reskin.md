# /channel-upgrade 视觉换肤实现计划（D3 琥珀金）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/channel-upgrade`（及其状态页、须知弹窗）套一套 D3 琥珀金浅色视觉皮肤 + 单栏布局 + 文案微调 + 动效，与 `/upgrade` 和站点主色（蓝/绿/紫）明显区分，且 `/upgrade` 逐字不变。

**Architecture:** 共享组件 `UpgradeFlow` / `UpgradeStatusView` 新增 `variant?: 'default' | 'channel'`，`default` 分支逐字保持现状；`channel` 分支只做「增删周边元素 + 切换语义色常量」，复用步骤卡片内部逻辑。配色/字体经新增的 `.channel-skin` 作用域 CSS 覆盖语义变量实现，页面外层套该类。

**Tech Stack:** Next.js (App Router) + React + Tailwind CSS v4 (`@theme inline` 语义变量) + next/font + node:test（源码断言）。

参考设计稿：`docs/superpowers/specs/2026-06-01-channel-upgrade-reskin-design.md`

---

## 文件结构

| 文件 | 职责 | 操作 |
| --- | --- | --- |
| `src/app/layout.tsx` | 全站 root layout；新增 Manrope 字体变量 `--font-channel` | 修改 |
| `src/config/style/channel-skin.css` | `.channel-skin` 作用域：D3 语义变量、字体、背景光晕、动效 keyframes | 新建 |
| `src/config/style/global.css` | `@import` 接入 channel-skin.css | 修改 |
| `src/shared/blocks/upgrade/upgrade-flow.tsx` | 主流程组件；加 `variant` + channel 分支 + 语义色常量 | 修改 |
| `src/shared/blocks/upgrade/upgrade-status-view.tsx` | 状态页组件；加 `variant` + D3 化 | 修改 |
| `src/app/channel-upgrade/page.tsx` | 套 `.channel-skin` + `variant="channel"` | 修改 |
| `src/app/channel-upgrade/status/[taskNo]/page.tsx` | 套 `.channel-skin` + `variant="channel"` | 修改 |
| `tests/upgrade-system/channel-upgrade-reskin.test.ts` | channel 入口与文案的源码断言 | 新建 |

**关键约束（来自 `reseller-upgrade-entry.test.ts`）:** channel 源码不得出现 `presentation="channel"`、`headingKicker/headingTitle`、`卡密兑换服务台`、`PARTNER SERVICE DESK`、`AFreeCoder01`、`Footer/Header/TopBanner`；须保留 `showSupportCard={false}`、`supportContact={null}`。本计划用 `variant="channel"`（不触发上述禁用 token）。

---

## Task 1: 引入 Manrope 字体（仅供 channel 作用域引用）

**Files:**
- Modify: `src/app/layout.tsx:3`（字体 import）、`:33-38`（字体实例）、`:117`（html className）

- [ ] **Step 1: 修改字体 import 行**

`src/app/layout.tsx` 第 3 行：
```tsx
import { JetBrains_Mono, Manrope, Merriweather, Noto_Sans_Mono } from 'next/font/google';
```

- [ ] **Step 2: 新增 Manrope 实例（放在 jetbrainsMono 定义之后，约 38 行后）**

```tsx
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-channel',
  display: 'swap',
  preload: false,
});
```

- [ ] **Step 3: 把变量挂到 html className（第 117 行）**

```tsx
      className={`${notoSansMono.variable} ${merriweather.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
```

- [ ] **Step 4: 验证类型**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/app/layout" || echo "layout OK"`
Expected: `layout OK`

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(channel-upgrade): 引入 Manrope 字体变量"
```

---

## Task 2: 新建 channel-skin.css 作用域主题

**Files:**
- Create: `src/config/style/channel-skin.css`
- Modify: `src/config/style/global.css:1-2`

- [ ] **Step 1: 创建 `src/config/style/channel-skin.css`**

```css
/* ============================================================
   /channel-upgrade —— D3 琥珀金 浅色清新主题（作用域 .channel-skin）
   仅作用于该容器，重定义语义变量 + 字体 + 背景，不影响 /upgrade 与全站。
   ============================================================ */
.channel-skin {
  --background: #fdfaf2;
  --foreground: #2a2316;
  --card: #ffffff;
  --card-foreground: #2a2316;
  --popover: #ffffff;
  --popover-foreground: #2a2316;
  --primary: #c77c12; /* 琥珀金 主色 */
  --primary-foreground: #ffffff;
  --secondary: #f6eedd;
  --secondary-foreground: #5a4a2e;
  --muted: #f4eedd;
  --muted-foreground: #897f66;
  --accent: #fbf1dc;
  --accent-foreground: #5a4a2e;
  --destructive: #dc2626; /* 错误红 */
  --destructive-foreground: #ffffff;
  --border: #efe6cf;
  --input: #efe6cf;
  --ring: #c77c12; /* 聚焦金环 */

  --font-sans: var(--font-channel), 'Manrope', ui-sans-serif, system-ui, sans-serif;
  font-family: var(--font-sans);

  min-height: 100vh;
  color: var(--foreground);
  background-color: var(--background);
  background-image: radial-gradient(
    68% 42% at 50% -6%,
    rgba(199, 124, 18, 0.1),
    transparent 70%
  );
}

/* ---- channel 动效（尊重 reduce-motion）---- */
@keyframes channel-fadeup {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
@keyframes channel-popin {
  0% { opacity: 0; transform: scale(0.8); }
  60% { transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes channel-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(199, 124, 18, 0.42); }
  50% { box-shadow: 0 0 0 5px rgba(199, 124, 18, 0); }
}
.channel-skin .channel-stage > * { opacity: 0; animation: channel-fadeup 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
.channel-skin .channel-stage > *:nth-child(1) { animation-delay: 0.05s; }
.channel-skin .channel-stage > *:nth-child(2) { animation-delay: 0.13s; }
.channel-skin .channel-stage > *:nth-child(3) { animation-delay: 0.21s; }
.channel-skin .channel-stage > *:nth-child(4) { animation-delay: 0.29s; }
.channel-skin .channel-stage > *:nth-child(5) { animation-delay: 0.37s; }
.channel-skin .channel-stage > *:nth-child(6) { animation-delay: 0.45s; }
.channel-skin .channel-pulse { animation: channel-pulse 2s infinite; }
.channel-skin .channel-popin { animation: channel-popin 0.4s ease both; }
.channel-skin .channel-lift { transition: transform 0.15s, box-shadow 0.2s; }
.channel-skin .channel-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(199, 124, 18, 0.32); }
.channel-skin .channel-lift:active { transform: translateY(0) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .channel-skin .channel-stage > *,
  .channel-skin .channel-pulse,
  .channel-skin .channel-popin { animation: none !important; opacity: 1 !important; }
  .channel-skin .channel-lift { transition: none !important; }
}
```

- [ ] **Step 2: 在 global.css 接入（第 2 行后）**

`src/config/style/global.css` 顶部：
```css
@import 'tailwindcss';
@import './theme.css';
@import './channel-skin.css';
```

- [ ] **Step 3: 验证文件可被 Tailwind 解析（构建 CSS 不报错）**

Run: `grep -c "channel-skin" src/config/style/global.css`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add src/config/style/channel-skin.css src/config/style/global.css
git commit -m "feat(channel-upgrade): 新增 .channel-skin 作用域主题"
```

---

## Task 3: UpgradeFlow 增加 variant 与语义色常量

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx:35-43`（Props）、`:48-56`（解构）、`:56` 后（常量）

- [ ] **Step 1: Props 类型增加 variant（替换 35-43 行的 type 块）**

```tsx
export type UpgradeFlowProps = {
  showSupportCard?: boolean;
  supportContact?: string | null;
  supportContactLabel?: string;
  submitErrorMessage?: string;
  failedHelpText?: string;
  safetyIssueText?: string;
  noticeConfig?: UpgradeNoticeConfig | null;
  /** 'default' = /upgrade 现状（不可改动）；'channel' = /channel-upgrade D3 琥珀金 */
  variant?: 'default' | 'channel';
};
```

- [ ] **Step 2: 解构 variant 并定义语义色常量（在 `noticeConfig = null,` 后加 `variant = 'default',`，并在 `}: UpgradeFlowProps = {}) {` 之后、`const [code...` 之前插入）**

```tsx
  variant = 'default',
}: UpgradeFlowProps = {}) {
  const isChannel = variant === 'channel';
  // channel 语义色（避开站点蓝/绿/紫；成功=深金、警告=赤褐、错误走 --destructive 红）。
  // default 值保持现状，保证 /upgrade 逐字不变。
  const doneBadge = isChannel
    ? 'bg-[#B45309] text-white'
    : 'bg-emerald-500 text-white';
  const successPill = isChannel
    ? 'bg-[#FBF1DC] text-[#8A5A12]'
    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  const successBtn = isChannel
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'bg-emerald-600 text-white hover:bg-emerald-700';
  const successCard = isChannel
    ? 'border-[#E7C98F] bg-[#FCF6E8]'
    : 'border-emerald-500/30 bg-emerald-50/50';
  const successIconWrap = isChannel ? 'bg-[#FBF1DC]' : 'bg-emerald-500/10';
  const successIconColor = isChannel ? 'text-[#B45309]' : 'text-emerald-600';
  const successTitle = isChannel
    ? 'text-[#8A5A12]'
    : 'text-emerald-700 dark:text-emerald-400';
  const successSubtle = isChannel
    ? 'text-[#8A6A2E]'
    : 'text-emerald-700/80 dark:text-emerald-300/80';
  const warnBox = isChannel
    ? 'border-[#F0DBCB] bg-[#FBF3EC]'
    : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10';
  const warnTitle = isChannel
    ? 'text-[#9A3412]'
    : 'text-amber-800 dark:text-amber-300';
  const warnSub = isChannel ? 'text-[#9A3412]/85' : 'text-sky-700 dark:text-sky-300';
  const btnSpinner = isChannel
    ? 'border-[#7a4a08]/40 border-t-[#7a4a08]'
    : 'border-white/30 border-t-white';

  const [code, setCode] = useState('');
```

- [ ] **Step 3: 验证类型**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-flow" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): UpgradeFlow 增加 variant 与语义色常量"
```

---

## Task 4: channel 标题区 + 删风险提示条 + 根容器换肤

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx:436-479`（背景装饰 + 标题区 + 风险条）

- [ ] **Step 1: 替换「背景装饰 + 标题区 + 邮箱风险提示」整段（当前 436-479 行）**

把现有 `{/* 背景装饰 */}` 到风险提示条 `</div>`（479 行）整段替换为：

```tsx
      {/* 背景装饰：default 紫色光晕；channel 由 .channel-skin 提供金色光晕 */}
      {!isChannel && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-primary/5 absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl" />
          <div className="bg-primary/5 absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl" />
        </div>
      )}

      <div
        className={`relative mx-auto px-4 py-10 sm:px-6 sm:py-16 ${isChannel ? 'channel-stage max-w-2xl' : 'max-w-5xl'}`}
      >
        {/* 标题区 */}
        {isChannel ? (
          <div className="mb-8 text-center">
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              GPT Plus 自助升级
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              全自动处理，通常 1-2 分钟完成升级
            </p>
          </div>
        ) : (
          <div className="mb-10 text-center">
            <div className="border-primary/20 bg-primary/5 text-primary mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              自助升级服务
            </div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              GPT 会员升级
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              全自动处理，通常 1-2 分钟完成升级
            </p>
          </div>
        )}

        {/* 邮箱风险提示：channel 不显示（Step2 检测到 outlook 邮箱时另有提示）*/}
        {!isChannel && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">邮箱风险提示</p>
            <p className="mt-1">
              因官方风控问题，GPT 账号为 outlook 或 hotmail 邮箱的用户，
              需要更换为 gmail、QQ 等其他邮箱。
            </p>
            <p className="mt-1 text-sky-700 dark:text-sky-300">
              更换步骤：网页登录
              ChatGPT，点击【头像—设置—账户—电子邮件】，进行修改。
            </p>
          </div>
        )}
```

- [ ] **Step 2: 验证 default 路径未变 & 类型**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-flow" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): channel 标题区与隐藏风险提示"
```

---

## Task 5: channel 顶部横向进度条

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx`（在主体 `flex` 容器之前插入，原 481 行 `<div className="flex flex-col gap-8 lg:flex-row">` 前）

- [ ] **Step 1: 在主体容器前插入进度条（channel 专属）**

紧接 Task 4 的标题/风险条之后、`<div className="flex flex-col gap-8 lg:flex-row">` 之前插入：

```tsx
        {isChannel && (
          <div className="mb-6 flex items-center px-1">
            {[
              { n: 1, label: '核验卡密' },
              { n: 2, label: '核验 Token' },
              { n: 3, label: '确认升级' },
            ].map((s, i) => (
              <div key={s.n} className="contents">
                {i > 0 && (
                  <div
                    className={`mb-[22px] h-0.5 flex-1 rounded ${currentStep > i ? 'bg-primary' : 'bg-border'}`}
                  />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      currentStep > s.n
                        ? doneBadge
                        : currentStep === s.n
                          ? 'bg-primary text-primary-foreground channel-pulse'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > s.n ? '✓' : s.n}
                  </div>
                  <span
                    className={`text-xs font-medium ${currentStep >= s.n ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 2: 验证类型**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-flow" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): channel 顶部横向进度条"
```

---

## Task 6: 单栏容器 + 右侧栏条件 + 安全保障移到底部

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx:481`（主体容器）、`:1032-1108`（右侧栏）

- [ ] **Step 1: 主体容器单栏化（481 行）**

```tsx
        <div className={`flex flex-col gap-8 ${isChannel ? '' : 'lg:flex-row'}`}>
```

- [ ] **Step 2: 右侧信息栏整体条件化，并在 channel 下于左侧主区底部加安全保障行**

把当前右侧栏（`{/* 右侧：信息面板 */}` 起，1032-1108 行那一整个 `<div className="w-full shrink-0 space-y-4 lg:w-72">...</div>`）用 `{!isChannel && ( ... )}` 包裹（内部内容逐字不变）。

然后在**左侧主区**的 `<div className="space-y-1">...</div>` 闭合之后（即升级结果卡片 `{taskNo && (...)}` 之后、左侧 `</div>` 之前），插入 channel 安全保障行：

```tsx
              {isChannel && (
                <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
                  <span className="inline-flex items-center gap-1.5">🔒 数据加密传输</span>
                  <span className="inline-flex items-center gap-1.5">⚡ 通常 1-2 分钟完成</span>
                  <span className="inline-flex items-center gap-1.5">🛡️ {safetyIssueText}</span>
                </div>
              )}
```

> 注：channel 下右侧栏不渲染（含"充值流程"与"安全保障"），其信息已由顶部进度条 + 此处底部安全保障行承载。default 右侧栏逐字不变。

- [ ] **Step 3: 验证类型 & JSX 平衡**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-flow" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): channel 单栏布局与底部安全保障"
```

---

## Task 7: 语义色金化（应用常量到步骤卡片与结果区）

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx`（多处 className，用 Task 3 常量替换硬编码 emerald/amber/white-spinner）

- [ ] **Step 1: 完成态徽章（3 处，原 `bg-emerald-500 text-white`）**

把 Step1（491 行）、Step2（620 行）、Step3（801 行）徽章三元里的 `'bg-emerald-500 text-white'` 改为 `doneBadge`。例如 Step1：
```tsx
className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${codeVerified ? doneBadge : currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
```
（Step2 的 `tokenParsed ?`、Step3 的 `taskNo ?` 同样把 `'bg-emerald-500 text-white'` → `doneBadge`。）

- [ ] **Step 2: "卡密有效" / "Token 验证通过" pill（595 行、762 行）**

将 `className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"` 改为：
```tsx
className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${successPill} ${isChannel ? 'channel-popin' : ''}`}
```
（两处文案分别为「卡密有效」「Token 验证通过」，其余不变。）

- [ ] **Step 3: code/token 验证按钮 spinner（552 行、733 行）+ submit spinner（898 行）**

将三处 `border-white/30 border-t-white` 改为 `${btnSpinner}`（把对应 `<span className="... border-white/30 border-t-white" />` 改成模板串 `className={\`... ${btnSpinner}\`}`）。

- [ ] **Step 4: code/token 主按钮 hover 上浮（channel）**

在 code 按钮（548 行）与 token 按钮（729 行）的 className 末尾追加 `${isChannel ? 'channel-lift' : ''}`。

- [ ] **Step 5: Step2 outlook 警告框（778-790 行）金化**

将 `className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10"` → `className={\`mt-3 rounded-lg border px-3 py-2.5 text-sm ${warnBox}\`}`；
内部 `text-amber-800 dark:text-amber-300` → `${warnTitle}`；`text-sky-700 dark:text-sky-300` → `${warnSub}`。

- [ ] **Step 6: Step3 确认/重试按钮（894 行）金化 + 上浮**

```tsx
className={`flex-1 rounded-xl py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${successBtn} ${isChannel ? 'channel-lift' : ''}`}
```

- [ ] **Step 7: 升级结果卡片金化（915、940、942、955、958、966 行）**

- 结果卡片容器（915）：`${taskStatus === 'succeeded' ? successCard : 'border-border/50 bg-card'}`
- 成功图标容器（940）：`bg-emerald-500/10` → `${successIconWrap}`，并加 `channel-popin`（channel 时）
- 成功图标色（942）：`text-emerald-600` → `${successIconColor}`
- 成功标题（955）：`text-emerald-700 dark:text-emerald-400` → `${successTitle}`
- 成功副文案（958）：`text-emerald-700/80 dark:text-emerald-300/80` → `${successSubtle}`
- 前往 ChatGPT 按钮（966）：`bg-emerald-600 text-white ... hover:bg-emerald-700` → `${successBtn}`，并追加 `${isChannel ? 'channel-lift' : ''}`

- [ ] **Step 8: 验证类型 + default 回归**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-flow" || echo "OK"`
Expected: `OK`
Run: `npx tsx --test tests/upgrade-system/upgrade-public-cardkey-ui.test.ts tests/upgrade-system/upgrade-outlook-warning.test.ts 2>&1 | tail -4`
Expected: `# fail 0`

- [ ] **Step 9: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): 语义色金化与动效类应用"
```

---

## Task 8: Notice Dialog channel 化

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-flow.tsx:374-432`（Dialog）

- [ ] **Step 1: DialogContent 挂作用域类（378 行）**

```tsx
            className={`flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] ${isChannel ? 'channel-skin' : ''}`}
```

- [ ] **Step 2: 头部背景（380 行）**

```tsx
            <div className={`shrink-0 border-b px-6 py-5 ${isChannel ? 'bg-[#FBF1DC] text-[#5A4A2E]' : 'bg-amber-50 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100'}`}>
```
并将 DialogDescription（385 行）的 `className="text-amber-900/80 dark:text-amber-100/75"` 改为 `className={isChannel ? 'text-[#8A6A2E]' : 'text-amber-900/80 dark:text-amber-100/75'}`。

- [ ] **Step 3: 须知项编号块（399 行）**

```tsx
className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${isChannel ? 'bg-[#FBF1DC] text-[#8A5A12]' : 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100'}`}
```

- [ ] **Step 4: 底部确认按钮（428 行）金化 + 上浮**

```tsx
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-colors ${successBtn} ${isChannel ? 'channel-lift' : ''}`}
```

- [ ] **Step 5: 验证 notice-dialog 测试不破坏（断言布局类仍在）**

Run: `npx tsx --test tests/upgrade-system/upgrade-notice-dialog.test.ts 2>&1 | tail -4`
Expected: `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-flow.tsx
git commit -m "feat(channel-upgrade): 升级须知弹窗 D3 化"
```

---

## Task 9: UpgradeStatusView 增加 variant 并 D3 化

**Files:**
- Modify: `src/shared/blocks/upgrade/upgrade-status-view.tsx`（Props、解构、statusConfig、return）

- [ ] **Step 1: Props 加 variant（type 块末尾）+ 解构 + isChannel**

```tsx
  failedHelpText?: string;
  /** 与 UpgradeFlow 一致：'default' / 'channel' */
  variant?: 'default' | 'channel';
};
```
解构追加 `variant = 'default',`，并在函数体首行加 `const isChannel = variant === 'channel';`

- [ ] **Step 2: statusConfig 与样式常量条件化**

将原 `statusConfig` 改为：channel 用 `succeeded: text-[#8A5A12]`、`pending: text-[#C77C12]`、`running: text-[#9A3412]`、`failed: text-destructive`、`canceled: text-muted-foreground`；default 保持原 yellow/blue/green/red/gray。并定义：
```tsx
const cardCls = isChannel ? 'border-border bg-card' : 'border-gray-200 bg-white shadow-sm';
const subtleText = isChannel ? 'text-muted-foreground' : 'text-gray-500';
const strongText = isChannel ? 'text-foreground' : 'text-gray-700';
const spinnerColor = isChannel ? 'border-primary' : 'border-blue-600';
const ctaCls = isChannel ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-green-600 text-white hover:bg-green-700';
```

- [ ] **Step 3: return 中套用常量**

- 标题 `text-gray-900` → `${isChannel ? 'text-foreground' : 'text-gray-900'}`
- error 框 `bg-red-50 text-red-600` → `${isChannel ? 'bg-destructive/10 text-destructive' : 'bg-red-50 text-red-600'}`
- 主卡片 `border-gray-200 bg-white shadow-sm` → `${cardCls}`
- 两处 spinner `border-blue-600` → `${spinnerColor}`
- 失败帮助文字 `text-gray-500`/`text-gray-700` → `${subtleText}`/`${strongText}`
- succeeded CTA `bg-green-600 ... hover:bg-green-700` → `${ctaCls}`，并追加 `${isChannel ? 'channel-lift' : ''}`

（完整改法参照设计稿第 8 节；default 分支逐字保持。）

- [ ] **Step 4: 验证类型**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "upgrade-status-view" || echo "OK"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add src/shared/blocks/upgrade/upgrade-status-view.tsx
git commit -m "feat(channel-upgrade): 状态页增加 variant 并 D3 化"
```

---

## Task 10: 页面接线（套作用域 + 传 variant）

**Files:**
- Modify: `src/app/channel-upgrade/page.tsx`、`src/app/channel-upgrade/status/[taskNo]/page.tsx`

- [ ] **Step 1: channel-upgrade/page.tsx 的 return**

```tsx
  return (
    <div className="channel-skin">
      <UpgradeFlow
        variant="channel"
        showSupportCard={false}
        supportContact={null}
        noticeConfig={noticeConfig}
        submitErrorMessage="升级异常，请联系购卡渠道处理"
        failedHelpText="升级异常，请联系购卡渠道处理，并提供任务编号。"
        safetyIssueText="异常请联系购卡渠道处理"
      />
    </div>
  );
```

- [ ] **Step 2: channel-upgrade/status/[taskNo]/page.tsx 的 return**

```tsx
  return (
    <div className="channel-skin">
      <UpgradeStatusView
        variant="channel"
        supportContact={null}
        failedHelpText="请联系购卡渠道处理，并提供任务编号："
      />
    </div>
  );
```

- [ ] **Step 3: Commit**

```bash
git add src/app/channel-upgrade/page.tsx "src/app/channel-upgrade/status/[taskNo]/page.tsx"
git commit -m "feat(channel-upgrade): 页面套 .channel-skin 并启用 channel variant"
```

---

## Task 11: 入口断言测试 + 全量回归 + 类型

**Files:**
- Create: `tests/upgrade-system/channel-upgrade-reskin.test.ts`

- [ ] **Step 1: 写断言测试**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

test('channel-upgrade 页面启用 channel variant 且套 .channel-skin', () => {
  const src = read('src/app/channel-upgrade/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin"/);
  // 不得触发 reseller 测试的禁用标记
  assert.doesNotMatch(src, /presentation="channel"/);
});

test('channel-upgrade 状态页同样启用 channel variant', () => {
  const src = read('src/app/channel-upgrade/status/[taskNo]/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin"/);
});

test('UpgradeFlow channel 文案：标题改为 GPT Plus 自助升级', () => {
  const src = read('src/shared/blocks/upgrade/upgrade-flow.tsx');
  assert.match(src, /GPT Plus 自助升级/);
});

test('.channel-skin 主题样式已定义并接入 global.css', () => {
  const skin = read('src/config/style/channel-skin.css');
  assert.match(skin, /\.channel-skin\s*\{/);
  assert.match(skin, /--primary:\s*#c77c12/i);
  const global = read('src/config/style/global.css');
  assert.match(global, /channel-skin\.css/);
});
```

- [ ] **Step 2: 运行新测试**

Run: `npx tsx --test tests/upgrade-system/channel-upgrade-reskin.test.ts 2>&1 | tail -5`
Expected: `# fail 0`

- [ ] **Step 3: 全量 upgrade 相关回归**

Run: `npx tsx --test tests/upgrade-system/reseller-upgrade-entry.test.ts tests/upgrade-system/upgrade-notice-dialog.test.ts tests/upgrade-system/upgrade-ad-funnel.test.ts tests/upgrade-system/upgrade-outlook-warning.test.ts tests/upgrade-system/upgrade-public-cardkey-ui.test.ts 2>&1 | tail -5`
Expected: `# fail 0`

- [ ] **Step 4: 类型检查（改动文件零错误）**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/(app/channel-upgrade|app/layout|shared/blocks/upgrade)" || echo "改动文件类型 OK"`
Expected: `改动文件类型 OK`

- [ ] **Step 5: Commit**

```bash
git add tests/upgrade-system/channel-upgrade-reskin.test.ts
git commit -m "test(channel-upgrade): channel 入口与主题断言"
```

---

## Task 12: 视觉验证（真实渲染）

**Files:** 无（验证步骤）

- [ ] **Step 1: 确认本地 dev server（3000）在运行**

Run: `curl -s -m 8 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/channel-upgrade`
Expected: `200`（若非 200，提示用户启动 `npm run dev` 或本地 DB）

- [ ] **Step 2: 截图 /channel-upgrade 与 /upgrade 对比**

用 Chrome headless（独立 user-data-dir，不碰用户浏览器 profile）分别截图：
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,1600 --user-data-dir=/tmp/ch-shot-channel \
  --screenshot=/tmp/shot-channel.png "http://127.0.0.1:3000/channel-upgrade"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,1600 --user-data-dir=/tmp/ch-shot-upgrade \
  --screenshot=/tmp/shot-upgrade.png "http://127.0.0.1:3000/upgrade"
```
然后用 Read 查看两张图，确认：
- `/channel-upgrade` 呈 D3 琥珀金（暖白底、金主色、Manrope、单栏、横向进度条、无 kicker、无顶部风险条、底部安全保障行）。
- `/upgrade` 与改动前**完全一致**（紫蓝、双栏、kicker、风险条都在）。

- [ ] **Step 3: 清理截图临时文件**

```bash
rm -f /tmp/shot-channel.png /tmp/shot-upgrade.png; rm -rf /tmp/ch-shot-channel /tmp/ch-shot-upgrade
```

---

## 已知次要项（本次不处理，记录备查）

- `redeemCodeTask` 的"卡密已被使用/处理中/失败"多状态提示条（emerald/sky/amber/gray 浅色 pill）在 channel 下仍用现有浅色样式；属低频边缘状态，视觉影响小，后续如需再统一为金/赤褐。

## 验证清单（完成后整体核对）

- [ ] `/upgrade` 截图与改动前一致（紫蓝/双栏/kicker/风险条）
- [ ] `/channel-upgrade` 呈 D3 琥珀金、单栏、进度条、新文案、动效
- [ ] 须知弹窗、状态页均为 D3 风格
- [ ] `reseller-upgrade-entry` 等 5 个回归测试 + 新断言测试全过
- [ ] `tsc` 改动文件零错误
