# dnscon.xyz Channel Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在统一升级流程中接入 `dnscon.xyz` 渠道，使后台可导入 dnscon 渠道卡密并自动完成 ChatGPT 账号升级。

**Architecture:** 新增一个独立 `dnscon.xyz` adapter，复用现有 `UpgradeChannelAdapter`、runner 卡密锁定和失败处理语义。Adapter 只封装 dnscon 前端逆向得到的 `redeem/verify`、`redeem/submit` API，并在无法确认充值结果时二次验卡，避免误释放已被上游消耗的渠道卡密。

**Tech Stack:** Next.js/TypeScript、Node test runner、Drizzle 现有升级系统模型、fetch API。

---

### Task 1: 写 dnscon adapter 行为测试

**Files:**

- Create: `tests/upgrade-system/upgrade-channel-dnscon.test.ts`

- [ ] **Step 1: 添加测试文件**

覆盖成功、首次验卡无效、submit 明确坏卡、submit 异常后二次验卡仍有效、submit 异常后二次验卡无效、Session JSON 无效、driver 注册七类行为。

- [ ] **Step 2: 运行红灯测试**

Run: `node --import tsx --test tests/upgrade-system/upgrade-channel-dnscon.test.ts`

Expected: 因为 `src/extensions/upgrade-channel/adapters/dnscon.ts` 尚不存在而失败。

### Task 2: 实现 dnscon adapter

**Files:**

- Create: `src/extensions/upgrade-channel/adapters/dnscon.ts`
- Modify: `src/extensions/upgrade-channel/runner.ts`

- [ ] **Step 1: 实现 adapter**

实现 `createDnsconAdapter()`，默认 base URL 为 `https://ht.gptai.vip/api`。请求体：

```ts
POST /redeem/verify { cardCode: channelCardkey }
POST /redeem/submit { cardCode: channelCardkey, tokenContent: sessionToken }
```

- [ ] **Step 2: 实现失败分类**

首次验卡无效禁用渠道卡密；submit 成功返回成功；submit 明确卡密错误禁用渠道卡密；submit 无法确认时二次验卡，仍有效则释放，变无效或验卡失败则占用并停止后续渠道。

- [ ] **Step 3: 注册 driver**

注册 `dnscon.xyz`，并在 runner 里 side-effect import 新 adapter。

- [ ] **Step 4: 运行绿灯测试**

Run: `node --import tsx --test tests/upgrade-system/upgrade-channel-dnscon.test.ts`

Expected: dnscon adapter 测试全部通过。

### Task 3: 更新文档并回归

**Files:**

- Modify: `docs/upgrade-system.md`

- [ ] **Step 1: 补充 dnscon 渠道章节**

记录 API base、请求路径、请求体、driver 配置、卡密状态策略和人工处理边界。

- [ ] **Step 2: 运行聚焦渠道测试**

Run:

```bash
node --import tsx --test \
  tests/upgrade-system/upgrade-channel-dnscon.test.ts \
  tests/upgrade-system/upgrade-channel-aifadian.test.ts \
  tests/upgrade-system/upgrade-channel-9977ai.test.ts \
  tests/upgrade-system/upgrade-channel-987ai.test.ts
```

Expected: 四个渠道 adapter 测试全部通过。

- [ ] **Step 3: 运行构建验证**

Run: `npm run build`

Expected: 构建成功。
