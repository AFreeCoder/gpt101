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

| 组件   | 技术                                  |
| ------ | ------------------------------------- |
| 框架   | Next.js 16 + React 19 + TypeScript    |
| 样式   | TailwindCSS                           |
| ORM    | Drizzle ORM                           |
| 数据库 | PostgreSQL 18                         |
| 认证   | Better Auth + RBAC                    |
| 部署   | Docker Compose（silicon 服务器 2C8G） |

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
Step 2: 粘贴 Session Token → 后端提取 accessToken
         调 ChatGPT accounts/check 校验 token 是否有效
         结合 accessToken claims / Session JSON / accounts/check 结果解析邮箱、账号、planType
         对照当前 Session 中的用户信息做一致性校验
         获取失败、账号不一致、已有 Plus 会员时直接拦截
    ↓
Step 3: 确认升级 → 创建 upgrade_task（status=pending），卡密标记 consumed
    ↓
Worker 取任务执行：
    ├─ 查 upgrade_channel 表，按 priority ASC 排序
    ├─ 遍历每个 active 渠道：
    │   ├─ requiresCardkey=true → 从 channel_cardkey 池锁一张
    │   ├─ 调用 adapter.execute()
    │   │   ├─ 987ai: 验卡密 → 验Token → 创建任务 → 轮询结果
    │   │   └─ 9977ai: verify_code → submit_json
    │   │       ├─ submit_json 失败 → reuse_record 自动重试 3 次
    │   │       ├─ verify_code 返回 used / is_new=false → 直接人工处理
    │   │       └─ 失败后不切换后续渠道
    │   ├─ 成功 → 渠道卡密 used，任务 succeeded
    │   ├─ 普通失败 → 释放渠道卡密，尝试下一个渠道
    │   └─ 终止型失败（如 9977ai）→ 渠道卡密 consumed，任务 failed，保留本站卡密占用并标记人工处理
    └─ 普通渠道全部失败 → 任务 failed，回滚本站卡密为 available
    ↓
前端轮询显示结果
```

### 2.2 数据模型

共新增 9 张表：

| 表名                      | 用途               | 核心字段                                                                             |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `redeem_code_batch`       | 本站卡密批次       | id, title(unique), productCode, memberType, count, unitPrice                         |
| `redeem_code`             | 本站卡密           | id, batchId, code(unique), productCode, memberType, status                           |
| `upgrade_channel`         | 上游升级渠道       | id, code(unique), name, driver, supportedProducts, status, priority, requiresCardkey |
| `channel_cardkey`         | 渠道卡密库存池     | id, channelId, cardkey, productCode, memberType, status                              |
| `upgrade_task`            | 升级任务           | id, taskNo(unique), redeemCodeId, sessionToken, chatgptEmail, status                 |
| `upgrade_task_attempt`    | 渠道尝试记录       | id, taskId, channelId, channelCardkeyId, attemptNo, status, errorMessage, durationMs |
| `renewal_discount`        | 老用户优惠验证记录 | id, verifyType, verifyValue(unique), discountResult                                  |
| `renewal_discount_coupon` | 发卡网优惠码池     | id, couponCode(unique), status, issuedToId                                           |
| `invoice_request`         | 发票申请           | id, recipientEmail, buyerName, buyerTaxId, status                                    |

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
  sessionToken: string; // 完整 JSON
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

| 步骤 | API                        | 说明                                    |
| ---- | -------------------------- | --------------------------------------- |
| 1    | `GET /api/card-keys/{key}` | 验证渠道卡密                            |
| 2    | `POST /api/parse-token`    | 验证 accessToken                        |
| 3    | `POST /api/tasks`          | 创建升级任务（含 force_recharge=false） |
| 4    | `GET /api/tasks/{id}`      | 轮询结果（3秒/次，最多30次）            |

Base URL: `https://api.987ai.vip/api`

关键参数（对比 API 文档和前端代码确认）：

- 创建任务时 `force_recharge` 固定为 `false`（不覆盖充值）
- `idp` 传空字符串
- Adapter 内部从完整 JSON 中提取 `accessToken` 再传给 987ai API

### 2.6 9977ai 渠道对接

9977ai 没有公开 API 文档，实际流程来自页面脚本逆向与真实卡密验证：

| 步骤 | 动作           | 请求方式                                                                             |
| ---- | -------------- | ------------------------------------------------------------------------------------ |
| 1    | `verify_code`  | `POST https://9977ai.vip/`，表单参数 `ajax=1&action=verify_code&activation_code=...` |
| 2    | `submit_json`  | `POST https://9977ai.vip/`，表单参数 `ajax=1&action=submit_json&json_token=...`      |
| 3    | `reuse_record` | `POST https://9977ai.vip/`，表单参数 `ajax=1&action=reuse_record`                    |

接入策略只对统一流程暴露：

- `verify_code`
- `submit_json`

特殊规则：

- `verify_code` 返回 `status=used` 或 `is_new=false`：直接终止后续渠道，任务转人工处理。
- `submit_json` 失败：后台自动调用 `reuse_record` 重试 3 次。
- 3 次仍失败：不再尝试下一个渠道。
- 对用户前端统一展示：`充值异常，请联系客服处理。`
- 对后台：
  - 若 `reuse_record` 明确返回“未找到对应的充值记录”，说明 9977 未建立可复用充值记录，渠道卡密释放回池。
  - 其他无法确认是否已绑定的失败仍把渠道卡密标记为已占用，不释放回池。
  - 本站卡密保持占用。
  - 任务写入 `manualRequired=true`，禁止后台普通重试。

### 2.7 Worker 机制

- **独立进程**：`worker.ts`，Docker 中用同一镜像、不同入口启动
- **轮询方式**：`setInterval` 每 30 秒查询 `upgrade_task` 中 status=pending 的任务
- **并发控制**：PG `SELECT ... FOR UPDATE SKIP LOCKED`
- **即时触发**：用户提交后由 `POST /api/upgrade/submit` 在服务端异步触发一次 Worker；管理员重试后由后台接口直接触发一次 Worker
- **优雅退出**：监听 SIGTERM，完成当前任务后退出

---

## 三、产品和会员类型

```typescript
const PRODUCT_TYPES = [
  {
    code: 'gpt',
    label: 'GPT',
    members: [
      { code: 'plus', label: 'Plus' },
      { code: 'pro100', label: 'Pro ($100)' },
      { code: 'pro200', label: 'Pro ($200)' },
    ],
  },
  { code: 'claude', label: 'Claude', members: [{ code: 'pro', label: 'Pro' }] },
  {
    code: 'gemini',
    label: 'Gemini',
    members: [{ code: 'advanced', label: 'Advanced' }],
  },
  {
    code: 'grok',
    label: 'Grok',
    members: [
      { code: 'premium', label: 'Premium' },
      { code: 'supergrok', label: 'SuperGrok' },
    ],
  },
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

Step 2 的实际校验策略：

1. 从 Session Token 中提取 `accessToken`
2. 调用 `https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27` 校验 access token 是否仍然有效
3. 结合以下三类信息合并出最终账号视图：
   - Session JSON 中的当前用户信息（`user.email`、`account.id`、`account.planType`）
   - access token 自身 claims 中可解析出的邮箱 / 账号 / 套餐信息
   - `accounts/check` 返回的实时账号状态（优先用于判断当前套餐）
4. 用 access token 校验得到的账号信息反向核对 Session JSON 中的当前用户信息
5. `currentPlan=plus` 时拦截；access token 无效、远程校验失败、账号信息不一致时也拦截

失败处理原则：

- `401/403`：视为 token 无效或已过期，提示用户重新获取 Session Token
- 网络超时 / 上游异常：提示“账号校验服务暂时不可用，请稍后重试”
- 返回字段不足：提示重新获取最新 Session Token
- 账号信息不一致：提示重新获取最新 Session Token，避免拿错号升级

数据库仍然存储完整 Session JSON（便于排查），adapter 在执行升级时自行提取 accessToken。

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

**前台 API（7 个）**：

- `POST /api/upgrade/verify-code` — 验证卡密
- `POST /api/upgrade/resolve-account` — 解析 Token
- `POST /api/upgrade/submit` — 提交升级任务
- `GET /api/upgrade/task/[taskNo]` — 查询任务状态
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

| 分类           | 案例                                                        | 结果        |
| -------------- | ----------------------------------------------------------- | ----------- |
| 卡密验证       | 有效卡密 / 已使用 / 不存在 / 格式错误 / 空输入              | ✅ 全部通过 |
| Token 验证     | planType=free 通过 / plus 拦截 / 缺字段 / 无效内容 / 空输入 | ✅ 全部通过 |
| 升级成功       | 提交→Worker→succeeded，卡密 consumed，渠道卡密 used         | ✅          |
| 升级失败       | 渠道失败→本站卡密回滚 available，渠道卡密释放回池           | ✅          |
| 无 active 渠道 | "No active channels available"，卡密回滚                    | ✅          |
| 管理员重试     | failed→pending→succeeded，新增 attempt 记录                 | ✅          |

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

---

## 十、2026-04-13 代码评审与修复记录

### 10.1 评审发现的问题

1. **任务领取不是原子操作**  
   `pickAndRunTasks()` 先查后改，没有按文档要求用同一事务里的 `FOR UPDATE SKIP LOCKED` 原子领取任务。并发 Worker 或手动触发接口同时执行时，同一条 `pending` 任务可能被重复执行。

2. **渠道卡密只按 productCode 取库存，没按 memberType 取**  
   当前库存池表同时存 `productCode` 和 `memberType`，但 Worker 锁卡时只按 `productCode` 过滤。对于 `gpt` 下的 `plus / pro100 / pro200`，存在锁错卡的风险。

3. **提交接口信任前端传入账号信息，没有服务端二次校验 Token**  
   文档要求后端解析 Session Token 并做字段完整性和会员状态校验，但 `/api/upgrade/submit` 之前只校验了基础字段是否存在，然后直接创建任务。

4. **管理员重试任务时没有重新占用本站卡密**  
   失败和取消任务会把本站卡密回滚为 `available`，但后台“重试”只把任务改回 `pending`，没有重新消费卡密，导致重试中的任务和新的用户提交之间可能共用同一张卡。

5. **管理员“标记成功”填写的渠道和卡密没有真正落库**  
   弹窗收集了渠道和卡密，但后端只把它们拼进备注，任务列表依赖的成功渠道字段没有更新，导致人工补单后的渠道信息无法正常展示。

6. **Worker Docker 构建链路缺少 `worker.js` 产物**  
   Dockerfile 复制的是 `worker.js`，仓库中实际维护的是 `worker.ts`。如果镜像构建阶段不显式编译 Worker，独立 Worker 容器会启动失败。

### 10.2 本次修复内容

- **任务领取改为事务内原子领取**  
  Worker 现在在同一事务中对最早的 `pending` 任务执行 `FOR UPDATE SKIP LOCKED`，随后立即切到 `running`，避免同一任务被多个执行器重复消费。

- **渠道卡密锁定补上 `memberType` 过滤**  
  Worker 运行任务时同时传递 `productCode + memberType`，渠道库存池也按这两个维度锁卡，避免混用不同会员档位的渠道卡。

- **提交升级时服务端重新解析 Session Token**  
  `submitUpgradeTask()` 现在会在服务端重新解析 Session Token，并以服务端解析出的邮箱、账号 ID、当前套餐为准写入任务记录，不再信任前端透传值。

- **后台重试时重新占用本站卡密**  
  管理员重试任务时，系统会先锁任务和本站卡密，确认状态允许后重新把卡密置为 `consumed`，再把任务改回 `pending`。

- **人工标记成功时补齐成功渠道信息**  
  后台“标记成功”现在传递 `channelId` 和渠道卡密，后端会落库成功渠道 ID，并把人工补单卡密写入任务 metadata；任务列表读取时会优先展示真实渠道卡密，缺失时回退到人工记录。

- **Docker 构建阶段显式编译 Worker**  
  镜像构建时会额外执行一次 `esbuild`，把 `worker.ts` 打包为 `worker.js`，确保 `gpt101-worker` 容器可以直接以 `node worker.js` 启动。

- **9977ai 渠道终止型失败策略**  
  9977ai adapter 现在支持 `verify_code` / `submit_json` / 内部 `reuse_record` 自动重试 3 次。进入 9977ai 的绑定型失败分支后不会再切下一个渠道，任务落为失败并标记人工处理。若复用记录明确不存在，渠道卡密释放回池；其他无法确认是否已绑定的失败仍保守占用渠道卡密与本站卡密。

- **用户侧失败文案统一收敛**  
  `/upgrade` 提交失败和 `/upgrade/status/[taskNo]` 失败终态统一展示为“充值异常，请联系客服处理。”，不再暴露卡密校验或渠道细节。

### 10.3 仍需真实环境确认的点

- 987ai 渠道在真实网络抖动、长时间轮询下的稳定性
- 多 Worker 并发时在 PostgreSQL 生产环境中的实际抢占表现
- 人工补单场景下后台展示与客服流程是否满足使用习惯

### 10.4 二次评审意见（Claude Opus）

针对 10.2 修复代码的二次评审，确认 6 个问题的修复方向均正确，但发现以下需要关注的点：

#### 需要修复

1. **JWT 纯 accessToken 解析的 catch 吞掉了 Plus 拦截异常**
   `src/shared/services/upgrade-task-helpers.ts:89` 的 `catch` 块会吞掉 `rejectPlusPlan` 抛出的错误。如果用户传了一个有效的 JWT 且 planType 是 plus，`rejectPlusPlan` 抛出的 "当前为 Plus 会员" 错误会被 catch 吞掉，最终返回通用的 "无法解析 Token" 错误，用户无法得到明确提示。**建议**：catch 中判断是否为 `rejectPlusPlan` 抛出的特定错误，若是则重新 throw。

2. **`runTask` 失败时错误信息字段名写错**
   `src/extensions/upgrade-channel/runner.ts:212` 写的是 `attempts[attempts.length - 1]?.message`，但 `AttemptRecord` 的字段名是 `errorMessage`，不是 `message`。这里取到的永远是 `undefined`，会 fallback 到 `'所有渠道尝试都失败了'`，导致最后一个渠道的具体错误信息丢失。**应改为** `.errorMessage`。

#### 建议关注

3. **`cancelTask` 没有处理 `running` 状态卡死的场景**
   修改后只允许 `pending` 和 `failed` 状态取消，`running` 状态的任务不可取消。如果 Worker 崩溃导致任务卡在 `running`，管理员目前只能直接改数据库。建议后续加超时机制或允许取消长时间 running 的任务。

4. **大量手动类型注解是 TypeScript 推导不生效的症状**
   多处加了形如 `(s: { status: string; count: number })` 的显式类型标注，这通常意味着 Drizzle ORM 返回值的类型推导没生效，根因可能是事务回调参数用了 `any` 类型的 `tx`。建议排查根因而非逐个手动标注。

5. **`mergeUpgradeTaskMetadata` 传 undefined 会删除已有字段**
   `src/shared/services/upgrade-task-helpers.ts:118-120` 中，传 `undefined`/`null`/空字符串会删除已有字段。在 `markTaskSuccess` 调用时，如果管理员不填 note，`adminNote: undefined` 会删除之前可能存在的 adminNote。当前场景影响不大，但语义上有歧义。

### 10.5 对二次评审意见的核实结论与处理

对 10.4 的 5 条二次评审意见逐条核实后，结论如下：

1. **JWT `plus` 用户提示被吞掉**  
   结论：**成立，已修复**。  
   处理：调整 `resolveSessionAccountPayload()` 的 JWT 分支，只捕获 Base64/JSON 解码失败，不再吞掉 `rejectPlusPlan()` 抛出的业务异常。现在 JWT 形式的 `plus` 用户会收到明确的“当前为 Plus 会员”提示。

2. **`runTask` 失败时错误字段名写错**  
   结论：**不成立，不修改**。  
   原因：`AttemptRecord` 结构中定义的字段名本来就是 `message`，不是 `errorMessage`，因此 `attempts[attempts.length - 1]?.message` 读取的是正确字段。

3. **`cancelTask` 未覆盖 `running` 卡死场景**  
   结论：**成立，但暂不在本次修复中处理**。  
   原因：当前实现有意禁止直接取消正常执行中的 `running` 任务，避免和 Worker 并发执行产生状态争用。后续应单独设计“超时回收 stale running 任务”或“管理员强制取消超时任务”机制。

4. **大量手动类型标注说明 TypeScript 推导失效**  
   结论：**现象成立，但不作为本次修复范围**。  
   原因：项目的 `db()` 抽象层为了兼容多数据库方言，整体就是按 `any` 返回，局部手动补类型是当前架构下的现实取舍，不是升级系统修复中单独引入的问题。

5. **`mergeUpgradeTaskMetadata` 中 `undefined` 会删除旧字段**  
   结论：**成立，已修复**。  
   处理：调整 merge 语义为：
   - `undefined`：保留原字段，不做修改
   - `null` / 空字符串：显式删除字段
     这样后台“标记成功”不填写备注时，不会误删历史 `adminNote`。

本轮追加修复后，升级系统相关 helper 的回归测试已覆盖：

- JWT `plus` 用户必须返回明确拦截提示
- `mergeUpgradeTaskMetadata()` 遇到 `undefined` 时保留旧值

### 10.6 Step 2 access token 真校验改造

结合 `../apipool` 的实现方式以及当前升级流程的实际问题，本轮进一步确认并落地了以下结论：

1. **Step 2 不能只做本地格式解析，必须做 access token 真校验**
   仅解析 Session JSON / JWT payload 只能拿到“看起来像账号信息”的内容，不能证明 token 当前仍有效，也不能证明当前套餐状态没有变化。

2. **Step 2 的真校验由本站完成，Step 3 渠道侧校验先保留**
   本站现在会在 Step 2 主动调用 `accounts/check` 做前置校验；但第三方渠道在实际升级时是否还需要自己的 token 预校验，仍由各 adapter 自己决定，暂不一刀切移除。

3. **access token 获取失败时必须区分失败类型**
   - token 无效 / 已过期：明确提示用户重新获取
   - 上游网络失败 / 超时：提示稍后重试
   - 账号信息不一致：拦截，避免误升到错误账号

#### 本次实现

- 新增 `src/shared/services/upgrade-account-resolver.ts`
  - 统一负责：
    - 从 Session Token 中提取 access token
    - 调 `accounts/check` 校验 token
    - 合并 Session JSON、access token claims、远程返回的账号信息
    - 核对邮箱 / 账号一致性
    - 按远程返回的当前套餐拦截 Plus 用户
- `resolveAccount()` 与 `submitUpgradeTask()` 已统一改为走这套服务端真校验逻辑
- 新增回归测试覆盖：
  - 远程返回 Plus 时必须拦截
  - 远程账号与当前 Session 信息不一致时必须拦截
  - access token 无效时返回明确错误
  - 远程获取失败时返回“稍后重试”提示
