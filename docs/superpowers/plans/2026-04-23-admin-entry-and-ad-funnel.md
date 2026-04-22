# Admin Entry And Ad Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在站点头部恢复现有模板登录入口，并为 `source=ad-plus` 的广告流量建立“立即升级 -> 核验卡密 -> 核验 Token”的前端漏斗，其中“点击核验 Token”同时记为 Google Ads conversion。

**Architecture:** 头部登录入口继续复用 `Header -> SignUser -> SignModal -> SignInForm` 现有链路，只新增 `callbackUrl=/admin` 透传，不引入新登录组件。广告漏斗继续复用当前 `gtag` 能力，在埋点模块增加更通用的事件/转化发送函数，并在广告页 CTA 与 `/upgrade` 的 Step 1 / Step 2 按钮点击点上按 `source=ad-plus` 做条件触发。

**Tech Stack:** Next.js App Router, React client components, next-intl, existing auth client, Google gtag integration, Node test runner + tsx

---

## File Structure

**Modify**
- `src/config/locale/messages/en/landing.json` - 启用英文站点头部登录入口
- `src/config/locale/messages/zh/landing.json` - 启用中文站点头部登录入口
- `src/shared/blocks/sign/sign-user.tsx` - 给未登录态登录入口补 `callbackUrl` 透传
- `src/shared/blocks/sign/sign-modal.tsx` - 把 `callbackUrl` 传给 `SignInForm`
- `src/themes/default/blocks/header.tsx` - 头部启用 `SignUser` 时固定传 `/admin`
- `src/shared/lib/gtag.ts` - 新增通用 gtag event / conversion 发送方法，保留 `sendOutboundClick`
- `src/themes/default/blocks/gpt101-hero.tsx` - `source=ad-plus` 时记录 `ad_plus_click_upgrade`
- `src/app/[locale]/(landing)/upgrade/page.tsx` - 读取 query 中的 `source`，在 Step 1 / Step 2 按钮点击时记录漏斗事件

**Create**
- `src/shared/lib/ad-funnel.ts` - 广告漏斗 helper，只在 `source=ad-plus` 时放行事件
- `tests/homepage/header-sign-entry.test.ts` - 头部登录入口与 `callbackUrl=/admin` 回归
- `tests/homepage/ad-funnel-hero.test.ts` - 广告页“立即升级”按钮漏斗事件回归
- `tests/upgrade-system/upgrade-ad-funnel.test.ts` - `/upgrade` 页面 Step 1 / Step 2 广告漏斗回归

**Keep As-Is But Read**
- `src/shared/blocks/sign/sign-in-form.tsx` - 确认登录成功时 `callbackURL` 行为
- `src/app/[locale]/(auth)/sign-in/page.tsx` - 确认 `callbackUrl` 默认值与回跳逻辑
- `src/config/locale/messages/en/pages/lp-upgrade-chatgpt.json` - 广告落地页升级按钮 URL 已是 `/upgrade?source=ad-plus`
- `src/config/locale/messages/zh/pages/lp-upgrade-chatgpt.json` - 广告落地页升级按钮 URL 已是 `/upgrade?source=ad-plus`

### Task 1: Restore Header Sign Entry

**Files:**
- Modify: `src/shared/blocks/sign/sign-user.tsx`
- Modify: `src/shared/blocks/sign/sign-modal.tsx`
- Modify: `src/themes/default/blocks/header.tsx`
- Modify: `src/config/locale/messages/en/landing.json`
- Modify: `src/config/locale/messages/zh/landing.json`
- Test: `tests/homepage/header-sign-entry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readHeader(locale: 'zh' | 'en') {
  const file = path.join(
    process.cwd(),
    'src/config/locale/messages',
    locale,
    'landing.json'
  );
  return JSON.parse(readFileSync(file, 'utf8')).header;
}

test('landing header enables sign entry for zh and en', () => {
  assert.equal(readHeader('zh').show_sign, true);
  assert.equal(readHeader('en').show_sign, true);
});

test('header passes /admin callback to SignUser', async () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/header.tsx'),
    'utf8'
  );
  assert.match(source, /<SignUser[^>]*callbackUrl=\"\\/admin\"/);
});

test('sign modal forwards callbackUrl to SignInForm', async () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/shared/blocks/sign/sign-modal.tsx'),
    'utf8'
  );
  assert.match(source, /<SignInForm callbackUrl=\\{callbackUrl\\}/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/homepage/header-sign-entry.test.ts
```

Expected:
- FAIL because `show_sign` is still `false`
- FAIL because `header.tsx` does not yet pass `callbackUrl="/admin"`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/shared/blocks/sign/sign-user.tsx
export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
  callbackUrl = '/',
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
  callbackUrl?: string;
}) {
  // ...
  return (
    <>
      {/* ... */}
      <SignModal callbackUrl={callbackUrl} />
    </>
  );
}

// src/themes/default/blocks/header.tsx
{header.show_sign ? (
  <SignUser userNav={header.user_nav} callbackUrl="/admin" />
) : null}
```

```json
// src/config/locale/messages/zh/landing.json
{
  "header": {
    "show_sign": true
  }
}
```

```json
// src/config/locale/messages/en/landing.json
{
  "header": {
    "show_sign": true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/homepage/header-sign-entry.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add \
  src/shared/blocks/sign/sign-user.tsx \
  src/shared/blocks/sign/sign-modal.tsx \
  src/themes/default/blocks/header.tsx \
  src/config/locale/messages/en/landing.json \
  src/config/locale/messages/zh/landing.json \
  tests/homepage/header-sign-entry.test.ts
git commit -m "feat: restore landing sign entry"
```

### Task 2: Add Reusable Ad Funnel Tracking Helpers

**Files:**
- Modify: `src/shared/lib/gtag.ts`
- Create: `src/shared/lib/ad-funnel.ts`
- Test: `tests/homepage/ad-funnel-hero.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldTrackAdPlusFunnel,
  getAdPlusFunnelEventName,
} from '../../src/shared/lib/ad-funnel';

test('only source=ad-plus enters ad funnel', () => {
  assert.equal(shouldTrackAdPlusFunnel('ad-plus'), true);
  assert.equal(shouldTrackAdPlusFunnel('home'), false);
  assert.equal(shouldTrackAdPlusFunnel(undefined), false);
});

test('ad-plus funnel event names are fixed', () => {
  assert.equal(getAdPlusFunnelEventName('upgrade'), 'ad_plus_click_upgrade');
  assert.equal(getAdPlusFunnelEventName('verify_code'), 'ad_plus_click_verify_code');
  assert.equal(getAdPlusFunnelEventName('verify_token'), 'ad_plus_click_verify_token');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/homepage/ad-funnel-hero.test.ts
```

Expected:
- FAIL because `src/shared/lib/ad-funnel.ts` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/lib/ad-funnel.ts
export type AdPlusFunnelStep = 'upgrade' | 'verify_code' | 'verify_token';

const AD_PLUS_EVENT_MAP: Record<AdPlusFunnelStep, string> = {
  upgrade: 'ad_plus_click_upgrade',
  verify_code: 'ad_plus_click_verify_code',
  verify_token: 'ad_plus_click_verify_token',
};

export function shouldTrackAdPlusFunnel(source?: string | null) {
  return source === 'ad-plus';
}

export function getAdPlusFunnelEventName(step: AdPlusFunnelStep) {
  return AD_PLUS_EVENT_MAP[step];
}
```

```ts
// src/shared/lib/gtag.ts
export function sendGtagEvent(eventName: string, params?: Record<string, unknown>) {
  ensureGtag();
  if (!window.gtag) return;
  window.gtag('event', eventName, params || {});
}

export function sendAdsConversion(
  callback?: () => void,
  params?: Record<string, unknown>
) {
  ensureGtag();
  if (!window.gtag || !CONVERSION_SEND_TO) {
    callback?.();
    return;
  }
  window.gtag('event', 'conversion', {
    send_to: CONVERSION_SEND_TO,
    ...(params || {}),
    event_callback: callback,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/homepage/ad-funnel-hero.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add \
  src/shared/lib/gtag.ts \
  src/shared/lib/ad-funnel.ts \
  tests/homepage/ad-funnel-hero.test.ts
git commit -m "feat: add ad plus funnel tracking helpers"
```

### Task 3: Track Ad Landing Page Upgrade Click

**Files:**
- Modify: `src/themes/default/blocks/gpt101-hero.tsx`
- Test: `tests/homepage/ad-funnel-hero.test.ts`

- [ ] **Step 1: Extend the failing test**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('gpt101 hero tracks ad-plus upgrade click before navigation', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/gpt101-hero.tsx'),
    'utf8'
  );
  assert.match(source, /ad_plus_click_upgrade/);
  assert.match(source, /shouldTrackAdPlusFunnel/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/homepage/ad-funnel-hero.test.ts
```

Expected:
- FAIL because the hero still only uses `sendOutboundClick`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/themes/default/blocks/gpt101-hero.tsx
import {
  getAdPlusFunnelEventName,
  shouldTrackAdPlusFunnel,
} from '@/shared/lib/ad-funnel';
import { sendGtagEvent, sendOutboundClick } from '@/shared/lib/gtag';

// inside upgrade button link branch
onClick={() => {
  const href = upgradeAction.href || '';
  const source =
    href.startsWith('/upgrade')
      ? new URL(href, 'https://gpt101.org').searchParams.get('source')
      : null;

  if (shouldTrackAdPlusFunnel(source)) {
    sendGtagEvent(getAdPlusFunnelEventName('upgrade'), { source });
  }
}}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/homepage/ad-funnel-hero.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add \
  src/themes/default/blocks/gpt101-hero.tsx \
  tests/homepage/ad-funnel-hero.test.ts
git commit -m "feat: track ad plus upgrade click"
```

### Task 4: Track Upgrade Page Verify Code / Verify Token Funnel

**Files:**
- Modify: `src/app/[locale]/(landing)/upgrade/page.tsx`
- Create: `tests/upgrade-system/upgrade-ad-funnel.test.ts`
- Test: `tests/upgrade-system/upgrade-ad-funnel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('upgrade page tracks ad-plus verify code and verify token steps', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/app/[locale]/(landing)/upgrade/page.tsx'),
    'utf8'
  );

  assert.match(source, /searchParams|URLSearchParams|window\\.location/);
  assert.match(source, /ad_plus_click_verify_code/);
  assert.match(source, /ad_plus_click_verify_token/);
  assert.match(source, /sendAdsConversion/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/upgrade-system/upgrade-ad-funnel.test.ts
```

Expected:
- FAIL because `/upgrade` does not read `source` or send funnel events

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/[locale]/(landing)/upgrade/page.tsx
import { useMemo } from 'react';
import { getAdPlusFunnelEventName, shouldTrackAdPlusFunnel } from '@/shared/lib/ad-funnel';
import { sendAdsConversion, sendGtagEvent } from '@/shared/lib/gtag';

const source = useMemo(() => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('source') || '';
}, []);

function trackAdPlusStep(step: 'verify_code' | 'verify_token') {
  if (!shouldTrackAdPlusFunnel(source)) return;
  const eventName = getAdPlusFunnelEventName(step);
  sendGtagEvent(eventName, { source });
  if (step === 'verify_token') {
    sendAdsConversion(undefined, { source, funnel_step: step });
  }
}

// Step 1 button click
onClick={() => {
  trackAdPlusStep('verify_code');
  void handleVerifyCode();
}}

// Step 2 button click
onClick={() => {
  trackAdPlusStep('verify_token');
  void handleParseToken();
}}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --import tsx --test tests/upgrade-system/upgrade-ad-funnel.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Run focused regression suite**

Run:

```bash
node --import tsx --test --test-concurrency=1 \
  tests/homepage/header-sign-entry.test.ts \
  tests/homepage/ad-funnel-hero.test.ts \
  tests/homepage/gpt101-hero-upgrade.test.ts \
  tests/homepage/lp-upgrade-chatgpt-buttons.test.ts \
  tests/upgrade-system/upgrade-ad-funnel.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add \
  src/app/[locale]/(landing)/upgrade/page.tsx \
  tests/upgrade-system/upgrade-ad-funnel.test.ts \
  tests/homepage/header-sign-entry.test.ts \
  tests/homepage/ad-funnel-hero.test.ts
git commit -m "feat: track ad plus upgrade funnel"
```

## Self-Review

- Spec coverage:
  - 登录入口恢复：Task 1
  - 复用现有弹窗：Task 1
  - `source=ad-plus` 三步漏斗：Task 2 / Task 3 / Task 4
  - `verify_token` 同时记 conversion：Task 4
  - 非 `ad-plus` 不触发：Task 2 / Task 4
- Placeholder scan:
  - 无 `TODO` / `TBD`
  - 每个任务都给了具体文件、测试命令和提交命令
- Type consistency:
  - 统一使用 `upgrade | verify_code | verify_token`
  - 统一使用事件名 `ad_plus_click_*`
