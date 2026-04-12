# GPT101 升级系统改造文档

## 一、项目背景

### 1.1 业务现状

GPT101.org 是一个 GPT 代充和镜像购买的门户网站，是当前主要利润来源。网站主要支持 GPT 代充（Plus/Pro）和镜像购买服务。

改造前的业务流程存在以下痛点：

1. **升级渠道暴露给用户**：首页硬编码展示 5 个渠道，用户需要自己选择渠道并在多个第三方网站间辗转，认知成本高
2. **支付闭环缺失**：支付在第三方发卡网完成，本站无法追踪订单状态（短期内不改，继续走发卡网）
3. **开票流程低效**：完全通过微信人工沟通
4. **老用户续费优惠繁琐**：手动通过微信发放发卡网优惠券

### 1.2 改造目标

- **卡密主权迁回本站**：本站预生成卡密 → 导出上传到发卡网商品 → 用户在发卡网买到的就是本站卡密 → 直接在本站兑换升级
- **全自动化升级**：用户输入本站卡密 + ChatGPT Session Token → 后端按优先级顺序尝试多渠道 → 成功即止 → 通知用户
- **渠道对用户透明**：前台只有一个"立即升级"入口，渠道列表和优先级在后台管理
- **发票私域化**：本站有轻表单页但不公开入口，客服发链接给用户填表

### 1.3 技术架构

| 组件 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | TailwindCSS |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL 18 |
| 认证 | Better Auth + RBAC |
| 部署 | Docker Compose（silicon 服务器 2C8G） |

---

## 二、系统设计

### 2.1 核心流程

```
用户在发卡网购买 → 获得本站卡密（GPT101-XXXXXXXX...）
    ↓
用户访问 /upgrade
    ↓
Step 1: 输入卡密 → 本站验证卡密有效性（查 redeem_code 表）
    ↓
Step 2: 粘贴 Session Token → 后端解析 JSON 提取邮箱、账号、planType
         校验字段完整性 + 拦截已有 Plus 会员
    ↓
Step 3: 确认升级 → 创建 upgrade_task（status=pending），卡密标记 consumed
    ↓
Worker 取任务执行：
    ├─ 查 upgrade_channel 表，按 priority ASC 排序
    ├─ 遍历每个 active 渠道：
    │   ├─ requiresCardkey=true → 从 channel_cardkey 池锁一张
    │   ├─ 调用 adapter.execute()
    │   │   └─ 987ai: 验卡密 → 验Token → 创建任务 → 轮询结果
    │   ├─ 成功 → 渠道卡密 used，任务 succeeded
    │   └─ 失败 → 释放渠道卡密，尝试下一个渠道
    └─ 全部失败 → 任务 failed，回滚本站卡密为 available
    ↓
前端轮询显示结果
```

### 2.2 数据模型

共新增 9 张表：

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| `redeem_code_batch` | 本站卡密批次 | id, title(unique), productCode, memberType, count, unitPrice |
| `redeem_code` | 本站卡密 | id, batchId, code(unique), productCode, memberType, status |
| `upgrade_channel` | 上游升级渠道 | id, code(unique), name, driver, supportedProducts, status, priority, requiresCardkey |
| `channel_cardkey` | 渠道卡密库存池 | id, channelId, cardkey, productCode, memberType, status |
| `upgrade_task` | 升级任务 | id, taskNo(unique), redeemCodeId, sessionToken, chatgptEmail, status |
| `upgrade_task_attempt` | 渠道尝试记录 | id, taskId, channelId, channelCardkeyId, attemptNo, status, errorMessage, durationMs |
| `renewal_discount` | 老用户优惠验证记录 | id, verifyType, verifyValue(unique), discountResult |
| `renewal_discount_coupon` | 发卡网优惠码池 | id, couponCode(unique), status, issuedToId |
| `invoice_request` | 发票申请 | id, recipientEmail, buyerName, buyerTaxId, status |

### 2.3 卡密状态机

**本站卡密 (redeem_code)**：
```
available → consumed（升级提交时）
consumed → available（升级失败/取消时回滚）
available → disabled（管理员手动禁用）
```

**渠道卡密 (channel_cardkey)**：
```
available → locked（Worker 取卡密时）
locked → used（升级成功）
locked → available（升级失败释放回池）
available → disabled（管理员手动禁用）
```

**升级任务 (upgrade_task)**：
```
pending → running → succeeded
                  → failed
failed → pending（管理员重试 / 用户重试）
failed → canceled（管理员取消）
canceled → pending（管理员重试）
```

### 2.4 渠道抽象层

所有渠道统一实现 `UpgradeChannelAdapter` 接口：

```typescript
interface UpgradeRequest {
  taskId: string;
  productCode: 'plus' | 'pro' | 'team';
  sessionToken: string;  // 完整 JSON
  chatgptEmail: string;
  channelCardkey?: string;
}

type UpgradeResult =
  | { ok: true; message?: string }
  | { ok: false; retryable: boolean; message: string };

interface UpgradeChannelAdapter {
  execute(req: UpgradeRequest): Promise<UpgradeResult>;
}
```

每个渠道一个文件（`src/extensions/upgrade-channel/adapters/`），通过 `registerAdapter(driverName, adapter)` 注册。Runner 按渠道的 `driver` 字段查找对应 adapter。

### 2.5 987ai 渠道对接

987ai 渠道的完整 API 流程（通过前端代码逆向确认）：

| 步骤 | API | 说明 |
|------|-----|------|
| 1 | `GET /api/card-keys/{key}` | 验证渠道卡密 |
| 2 | `POST /api/parse-token` | 验证 accessToken |
| 3 | `POST /api/tasks` | 创建升级任务（含 force_recharge=false） |
| 4 | `GET /api/tasks/{id}` | 轮询结果（3秒/次，最多30次） |

Base URL: `https://api.987ai.vip/api`

关键参数（对比 API 文档和前端代码确认）：
- 创建任务时 `force_recharge` 固定为 `false`（不覆盖充值）
- `idp` 传空字符串
- Adapter 内部从完整 JSON 中提取 `accessToken` 再传给 987ai API

### 2.6 Worker 机制

- **独立进程**：`worker.ts`，Docker 中用同一镜像、不同入口启动
- **轮询方式**：`setInterval` 每 30 秒查询 `upgrade_task` 中 status=pending 的任务
- **并发控制**：PG `SELECT ... FOR UPDATE SKIP LOCKED`
- **即时触发**：用户提交后、管理员重试后，都会调 `POST /api/upgrade/worker` 立即触发一次
- **优雅退出**：监听 SIGTERM，完成当前任务后退出

---

## 三、产品和会员类型

```typescript
const PRODUCT_TYPES = [
  { code: 'gpt', label: 'GPT', members: [
    { code: 'plus', label: 'Plus' },
    { code: 'pro100', label: 'Pro ($100)' },
    { code: 'pro200', label: 'Pro ($200)' },
  ]},
  { code: 'claude', label: 'Claude', members: [
    { code: 'pro', label: 'Pro' },
  ]},
  { code: 'gemini', label: 'Gemini', members: [
    { code: 'advanced', label: 'Advanced' },
  ]},
  { code: 'grok', label: 'Grok', members: [
    { code: 'premium', label: 'Premium' },
    { code: 'supergrok', label: 'SuperGrok' },
  ]},
];
```

本站卡密格式：`GPT101-` + 32 位大写字母和数字（如 `GPT101-V6Z1D9DYS64JPVE16UG841UROJLZVVD1`）

---

## 四、管理后台功能

### 4.1 侧边栏菜单结构

```
升级管理
├── 卡密管理
│   ├── 卡密列表（筛选/搜索/批量禁用/批量删除/导出）
│   ├── 批量生成（选产品+会员类型+数量+单价）
│   └── 批次管理（查看批次详情/导出 CSV）
├── 上游渠道
│   ├── 渠道管理（增删改查/优先级/状态开关）
│   └── 卡密管理（按渠道导入/删除/查询）
├── 升级任务
│   ├── 任务结果（本站卡密/邮箱/状态/渠道/Token/操作）
│   └── 任务记录（每次渠道尝试的明细）
└── 发票管理
```

### 4.2 关键操作

**任务结果页操作**：
- **重试**：failed/canceled 任务可重试，重置为 pending 并立即触发 Worker
- **标记成功**：弹窗填写渠道和卡密信息
- **取消**：回滚本站卡密为 available
- **查看 Token**：弹窗展示完整 Session Token

**卡密管理操作**：
- 批量生成（批次名自动生成）
- 批量导入（文本框粘贴）
- 批量禁用/启用/删除（仅未使用的可删除）
- 导出（弹窗文本 + 一键复制）

---

## 五、前台升级页面

### 5.1 用户交互流程

```
Step 1: 输入卡密 → [立即核验]
    ↓ 验证通过，显示"卡密有效"
Step 2: 粘贴 Token → [核验 Token]
    ↓ 显示邮箱和当前会员状态
    ↓ planType=plus → 拦截提示"请等会员到期后再充值"
    ↓ planType=free → 进入 Step 3
Step 3: 确认信息 → [确认升级] / [重试升级]
    ↓
结果卡片：
    ├─ 轮询中：转圈动画 + "一般充值预计10分钟左右"
    ├─ 成功：绿色 ✓ + "前往 ChatGPT" + "继续升级"
    └─ 失败：红色提示 + "充值遇到一点小问题" + 客服微信
```

### 5.2 失败后的用户选择

- **Step 3 "重试升级"按钮**：用相同的卡密和 token 重新提交（创建新任务）
- **Step 2 "返回修改"**：重新粘贴 token 再核验
- **Step 2 "上一步"**：回到 Step 1 换卡密
- **成功后 "继续升级"**：重置页面，升级其他账号

### 5.3 Token 验证规则

校验的字段：
- `user.id` — 必须存在
- `user.email` — 必须存在
- `account.id` — 必须存在
- `account.planType` — 必须存在；如果值为 `plus` 则拦截
- `accessToken` — 必须存在

数据库存储完整 JSON（便于排查），adapter 自行提取 accessToken。

---

## 六、部署架构

### 6.1 目标环境

silicon 服务器 (2C8G)，Docker Compose 部署：

```
silicon 服务器
├── Docker Compose
│   ├── gpt101 (Next.js standalone, port 3001)
│   ├── gpt101-worker (同一镜像, CMD: node worker.js)
│   └── gpt101-postgres (PostgreSQL 18, 内部网络)
├── Caddy (反向代理, gpt101.org → localhost:3001)
└── 已有服务 (mysql8, openclaw-gateway)
```

### 6.2 开发分支策略

- 开发分支：`feature/upgrade-system`
- 主分支 `main` 和 Vercel 生产环境全程不受影响
- 验证通过后合并回 main，DNS 从 Vercel 切到 silicon

### 6.3 RBAC 初始化

```bash
# 初始化权限和角色
DATABASE_URL="postgresql://..." npx tsx scripts/init-rbac.ts --admin-email=xxx@xxx.com
```

新增权限点：
- `admin.redeem-codes.read/write/delete`
- `admin.upgrade-channels.read/write`
- `admin.channel-cardkeys.read/write`
- `admin.upgrade-tasks.read/write`
- `admin.invoices.read/write`

---

## 七、文件变更清单

### 7.1 统计

- 分支：`feature/upgrade-system`
- 提交数：69 commits
- 文件数：67 files changed
- 新增代码：6,572 行
- 删除代码：107 行

### 7.2 新增文件

**部署配置**：
- `deploy/docker-compose.yml` — 生产部署编排
- `deploy/.env.example` — 环境变量模板
- `Dockerfile` — 修改，增加 worker.js 复制
- `worker.ts` — Worker 独立进程入口

**数据库 Schema**：
- `src/config/db/schema.postgres.ts` — 新增 9 张表定义

**核心业务逻辑**：
- `src/shared/lib/redeem-code.ts` — 卡密生成、格式校验、产品类型配置
- `src/shared/models/redeem-code.ts` — 本站卡密 CRUD
- `src/shared/models/channel-cardkey.ts` — 渠道卡密 CRUD
- `src/shared/models/upgrade-channel.ts` — 渠道 CRUD
- `src/shared/services/upgrade-task.ts` — 升级任务服务（提交/查询/重试/取消）
- `src/extensions/upgrade-channel/types.ts` — 接口定义
- `src/extensions/upgrade-channel/registry.ts` — adapter 注册表
- `src/extensions/upgrade-channel/runner.ts` — 任务编排（按优先级遍历渠道）
- `src/extensions/upgrade-channel/adapters/987ai.ts` — 987ai 渠道 adapter
- `src/extensions/upgrade-channel/adapters/mock.ts` — 测试用 mock adapter

**前台页面**：
- `src/app/[locale]/(landing)/upgrade/page.tsx` — 升级页面（3 步流程）
- `src/app/[locale]/(landing)/upgrade/status/[taskNo]/page.tsx` — 状态轮询页
- `src/app/[locale]/(landing)/invoice/page.tsx` — 发票申请表单
- `src/app/[locale]/(landing)/renewal-discount/page.tsx` — 老用户优惠

**前台 API（8 个）**：
- `POST /api/upgrade/verify-code` — 验证卡密
- `POST /api/upgrade/resolve-account` — 解析 Token
- `POST /api/upgrade/submit` — 提交升级任务
- `GET /api/upgrade/task/[taskNo]` — 查询任务状态
- `POST /api/upgrade/worker` — 手动触发 Worker
- `POST /api/renewal-discount/verify` — 老用户优惠验证
- `POST /api/invoice/submit` — 发票提交
- `GET /api/invoice/history` — 发票历史

**管理后台页面（10 个）**：
- 卡密列表 / 批量生成 / 批次管理 / 批次详情
- 渠道管理 / 渠道卡密管理
- 任务结果 / 任务记录
- 发票管理

**管理后台 API（15 个）**：
- 卡密：list / generate / disable / delete / export
- 渠道：list / create / update / delete
- 渠道卡密：list / import / delete
- 任务：list / retry / cancel / markSuccess
- 任务记录：list
- 优惠码导入：import-coupons

### 7.3 修改文件

- `scripts/init-rbac.ts` — 新增 12 个权限点 + 绑定 admin 角色
- `src/core/rbac/permission.ts` — 新增权限常量
- `src/config/locale/messages/zh/admin/sidebar.json` — 新增侧边栏菜单
- `src/config/locale/messages/zh/pages/index.json` — 首页"立即升级"指向 /upgrade
- `src/config/locale/messages/zh/pages/lp-upgrade-chatgpt.json` — 广告页指向 /upgrade
- `src/app/[locale]/(auth)/sign-in/page.tsx` — 登录后跳转 /admin
- `src/app/[locale]/(landing)/gpt-upgrade-987ai/page.tsx` — 改为 redirect
- `src/app/[locale]/(landing)/gpt-upgrade-xiaobei/page.tsx` — 改为 redirect
- `src/shared/blocks/common/top-banner.tsx` — 通知栏配色优化
- `src/themes/default/blocks/gpt101-hero.tsx` — 去除紫色渐变

---

## 八、测试验证

### 8.1 已验证的测试案例

| 分类 | 案例 | 结果 |
|------|------|------|
| 卡密验证 | 有效卡密 / 已使用 / 不存在 / 格式错误 / 空输入 | ✅ 全部通过 |
| Token 验证 | planType=free 通过 / plus 拦截 / 缺字段 / 无效内容 / 空输入 | ✅ 全部通过 |
| 升级成功 | 提交→Worker→succeeded，卡密 consumed，渠道卡密 used | ✅ |
| 升级失败 | 渠道失败→本站卡密回滚 available，渠道卡密释放回池 | ✅ |
| 无 active 渠道 | "No active channels available"，卡密回滚 | ✅ |
| 管理员重试 | failed→pending→succeeded，新增 attempt 记录 | ✅ |

### 8.2 待真实环境验证

- 987ai adapter 的真实 HTTP 请求（需要有效的渠道卡密和 accessToken）
- 多渠道故障转移（需要配置多个渠道）
- Worker 独立进程在 Docker 中的运行稳定性
- 发卡网商品过渡（创建新商品，导入本站卡密）

---

## 九、后续计划

### Phase 2 — 全渠道接入
- 9977ai、aifadian 等渠道 adapter 逐个接入
- 每个渠道按需导入渠道卡密

### Phase 3 — 发票系统
- 客服发送固定 URL 给用户填表
- 后台批量导出待开清单 + 邮件发送

### Phase 4 — 老用户优惠
- 发卡网批量生成优惠码 → 导入本站码池
- 用户验证旧订单号/卡密 → 发放优惠码

### 后续优化
- 网站整体设计风格优化
- 对接 Stripe 支付（材料准备好后）
- Vercel 下线，DNS 切换到 silicon
