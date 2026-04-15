# 9977ai Channel Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在统一升级流程里接入 9977ai 渠道，并实现它的终止型失败策略与简化前端提示。

**Architecture:** 保持统一流程入口不变，9977ai 适配器内部自行处理 `verify_code`、`submit_json` 和失败后的 `reuse_record` 重试。Runner 只新增最小失败控制字段，用于决定是否停止后续渠道尝试、是否保留本站卡密、以及渠道卡密在失败后的处理方式。

**Tech Stack:** Next.js, TypeScript, Drizzle ORM, node:test, tsx

---

### Task 1: 写测试锁定 9977ai 的渠道失败策略

**Files:**
- Create: `tests/upgrade-system/upgrade-channel-9977ai.test.ts`
- Create: `tests/upgrade-system/upgrade-runner-9977-strategy.test.ts`
- Modify: `src/extensions/upgrade-channel/types.ts`
- Modify: `src/extensions/upgrade-channel/runner.ts`

- [ ] 为 9977ai adapter 写失败与重试测试
- [ ] 为 Runner 写终止型失败策略测试
- [ ] 先运行新增测试，确认失败

### Task 2: 实现 9977ai adapter 与 Runner 最小扩展

**Files:**
- Create: `src/extensions/upgrade-channel/adapters/9977ai.ts`
- Modify: `src/extensions/upgrade-channel/types.ts`
- Modify: `src/extensions/upgrade-channel/runner.ts`

- [ ] 增加失败控制字段定义
- [ ] 实现 9977ai 的会话型表单请求
- [ ] 实现 `submit_json` 失败后的 `reuse_record` 三次重试
- [ ] 让 Runner 支持“停止后续渠道 + 消耗渠道卡密 + 保留本站卡密”

### Task 3: 收敛前端失败文案

**Files:**
- Modify: `src/shared/services/upgrade-task.ts`
- Modify: `src/app/[locale]/(landing)/upgrade/page.tsx`

- [ ] 统一用户侧终态失败文案为“充值异常，请联系客服处理”
- [ ] 保留后台详细错误信息供任务排查

### Task 4: 完整回归

**Files:**
- Modify: `docs/upgrade-system.md`

- [ ] 运行新增自动化测试
- [ ] 运行现有升级系统测试
- [ ] 执行本地数据库/API/前端回归
- [ ] 将 9977ai 规则补充到升级文档
