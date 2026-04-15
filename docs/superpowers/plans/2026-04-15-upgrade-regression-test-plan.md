# 升级系统回归测试计划

> **执行方式：** 当前会话直接按本计划执行本地回归；执行中记录实际通过项、失败项、阻塞项与残余风险。

**目标：** 围绕“统一用户升级流程、各渠道升级流程后台化”这一目标，对升级系统进行一次覆盖后台数据结构、接口、后台管理能力、前台升级流程的本地回归验证。

**测试思路：** 先验证底座是否成立，再验证接口和状态机，最后验证用户前台流程与后台管理链路。优先复测升级文档中已修复的高风险问题：任务原子领取、渠道卡密按 `productCode + memberType` 锁定、提交时服务端二次校验 Token、失败回滚、后台重试重新占用本站卡密、人工标记成功落库。

**技术栈：** Next.js 16、React 19、TypeScript、Drizzle ORM、PostgreSQL、Better Auth、Node.js `node:test`、本地浏览器手工回归。

---

## 一、测试范围

### 1. 纳入本次回归

- 数据结构
  - `redeem_code_batch`
  - `redeem_code`
  - `upgrade_channel`
  - `channel_cardkey`
  - `upgrade_task`
  - `upgrade_task_attempt`
- 服务层 / Worker
  - `src/shared/services/upgrade-task.ts`
  - `src/shared/services/upgrade-account-resolver.ts`
  - `src/shared/services/upgrade-task-helpers.ts`
  - `src/extensions/upgrade-channel/runner.ts`
  - `src/extensions/upgrade-channel/adapters/mock.ts`
  - `src/extensions/upgrade-channel/adapters/987ai.ts`
- 对外接口
  - `POST /api/upgrade/verify-code`
  - `POST /api/upgrade/resolve-account`
  - `POST /api/upgrade/submit`
  - `GET /api/upgrade/task/[taskNo]`
  - `POST /api/upgrade/worker`
- 后台管理接口
  - 本站卡密：生成、列表、禁用、删除、导出
  - 渠道：创建、列表、更新、删除
  - 渠道卡密：导入、列表、删除
  - 升级任务：列表、重试、标记成功、取消
  - 升级尝试记录：列表
- 前台页面
  - `src/app/[locale]/(landing)/upgrade/page.tsx`
  - `src/app/[locale]/(landing)/upgrade/status/[taskNo]/page.tsx`

### 2. 本次不纳入完成口径

- 987ai 真实卡密 + 真实 access token 的联调
- Docker 中独立 Worker 的长时间稳定性
- 发票、续费优惠、发卡网商品迁移

这些内容本次只记录风险，不作为“本地回归完成”的判定项。

## 二、测试环境与数据策略

### 1. 本地环境

- 使用仓库现有 `.env` / `.env.local`
- 数据库提供方：`postgresql`
- 本地应用地址：`http://localhost:3000`

### 2. 测试数据策略

- 使用隔离前缀，避免污染已有业务数据：
  - 渠道代码前缀：`reg-20260415-*`
  - 批次产品/备注标识：`regression`
  - 渠道卡密内容前缀：`REG-20260415-*`
- 优先使用 `mock` adapter 验证主链路
- 需要验证服务端 Token 真校验时：
  - 单元/脚本层通过 mocked `fetch` 覆盖 `accounts/check`
  - 前端页手工回归通过浏览器侧 mock `/api/upgrade/*` 返回值验证 UI 分支

## 三、回归矩阵

### A. 数据结构与状态机

1. 表存在性、关键字段、索引存在
2. 唯一约束有效
   - `redeem_code_batch.title`
   - `redeem_code.code`
   - `upgrade_channel.code`
3. 状态机流转正确
   - 本站卡密：`available -> consumed -> available/disabled`
   - 渠道卡密：`available -> locked -> used/available/disabled`
   - 任务：`pending -> running -> succeeded/failed`，`failed/canceled -> pending`
4. 渠道卡密锁定必须同时按 `productCode + memberType`
5. 任务失败时本站卡密必须回滚
6. 任务成功时渠道卡密必须标记 `used`

### B. 公共升级接口

1. `/api/upgrade/verify-code`
   - 空输入
   - 格式错误
   - 不存在
   - 已使用
   - 已禁用
   - 有效卡密
2. `/api/upgrade/resolve-account`
   - 缺少 `sessionToken`
   - JSON 缺字段
   - JWT 缺 claims
   - 远程返回 `plus`
   - 远程账号与本地 Session 不一致
   - access token 失效
   - 远程超时 / 网络失败
   - 正常 free 用户
3. `/api/upgrade/submit`
   - 缺少卡密
   - 缺少 token
   - 卡密格式错误
   - 卡密不可用
   - 服务端真校验拦截 plus 用户
   - 创建任务后卡密立即变为 `consumed`
4. `/api/upgrade/worker`
   - 有待处理任务时能消费
   - 无待处理任务时返回 `processed=0`
5. `/api/upgrade/task/[taskNo]`
   - 不存在任务
   - `pending/running/succeeded/failed/canceled` 各终态文案

### C. 后台管理能力

1. 本站卡密
   - 批量生成
   - 列表筛选
   - 导出
   - 批量禁用 / 启用
   - 仅 `available/disabled` 可删除
2. 升级渠道
   - 创建
   - 唯一 code 冲突
   - 按优先级排序
   - 删除前检测关联渠道卡密
3. 渠道卡密
   - 导入去重
   - 按渠道 / 产品 / 会员类型 / 状态筛选
   - 仅 `available/disabled` 可删除
4. 升级任务
   - 列表查询
   - 失败任务重试时重新占用本站卡密
   - 取消任务后回滚本站卡密
   - 人工标记成功后 `successChannelId` 与 metadata 同步落库
5. 尝试记录
   - 按任务编号查询
   - 展示渠道、渠道卡密、失败原因、耗时

### D. 前台升级流程

1. Step 1 核验卡密
   - 错误提示
   - 成功提示
   - 成功后进入 Step 2
2. Step 2 核验 Token
   - 前端 JSON 缺字段校验
   - 服务端错误提示透出
   - free 用户展示邮箱
   - plus 用户拦截
   - “上一步”“返回修改”动作
3. Step 3 确认升级
   - 显示账号和会员类型
   - 提交后进入轮询
   - 失败后显示“重试升级”
4. 结果态
   - 处理中
   - 成功
   - 失败
   - “继续升级”重置表单
5. 状态页 `/upgrade/status/[taskNo]`
   - 查询成功
   - 查询失败
   - 终态停止轮询

## 四、重点复测的历史问题

1. `pickAndRunTasks()` 是否通过事务 + `FOR UPDATE SKIP LOCKED` 原子领取任务
2. `acquireCardkey()` 是否按 `productCode + memberType` 取库存
3. `submitUpgradeTask()` 是否忽略前端传入账号信息，改用服务端解析结果
4. `retryTask()` 是否先重新占用本站卡密再改回 `pending`
5. `markTaskSuccess()` 是否真正写入 `successChannelId` 与人工补单 metadata
6. `resolveVerifiedSessionAccount()` 是否以远程 `accounts/check` 为准拦截 plus
7. `mergeUpgradeTaskMetadata()` 传 `undefined` 时是否保留历史字段

## 五、执行顺序

### 任务 1：基线检查

- [x] 确认当前工作区为脏树，避免误改业务代码
- [x] 确认本地 Node / pnpm / env / PostgreSQL 可用
- [x] 确认升级相关表存在

### 任务 2：自动化回归

- [x] 运行现有单测：`tests/upgrade-system/*.test.ts`
- [x] 补跑数据库结构检查脚本
- [x] 编写并执行一次服务层回归脚本，覆盖：
  - mock 渠道成功链路
  - mock 渠道失败回滚链路
  - 重试重新占用本站卡密
  - 人工标记成功落库

### 任务 3：接口回归

- [x] 直接调用公共 API 做 smoke test
- [x] 验证无权限时后台 API 的保护行为
- [x] 在脚本层验证后台核心服务动作

### 任务 4：前端回归

- [x] 使用本地已运行的 `http://localhost:3000` 服务做页面回归
- [x] 手工回归 `/upgrade`
- [x] 手工回归 `/upgrade/status/[taskNo]`
- [x] 记录成功、失败、阻塞项

## 六、通过标准

- 自动化测试全绿
- 数据结构检查无缺表、无关键字段缺失
- mock 渠道主链路覆盖成功 / 失败 / 重试 / 人工成功四类关键业务流
- 前台 `/upgrade` 的四类核心界面状态可稳定复现：卡密失败、Token 失败、提交成功轮询、失败后重试
- 若存在无法在本地闭环的项，必须明确写出阻塞原因与建议的线上补测方式

## 七、执行结果（2026-04-15）

### 已完成

- 单测：`11/11` 通过
- 数据结构检查：6 张升级核心表存在；关键字段存在；关键索引存在
- 服务层回归：
  - mock 成功链路通过
  - mock 失败回滚通过
  - 重试重新占用本站卡密通过
  - 人工标记成功落库通过
  - 并发领取同一任务仅执行一次通过
- 接口 smoke：
  - `/api/upgrade/verify-code`、`/api/upgrade/resolve-account`、`/api/upgrade/submit`、`/api/upgrade/worker`、`/api/upgrade/task/[taskNo]` 通过
  - 后台接口在无权限时返回 `无权限`
- 前端回归：
  - `/upgrade`：Step1 错误态、Step1 成功态、Step2 前端缺字段校验、Step3 失败态、Step3 成功态、成功后“继续升级”重置均已验证
  - `/upgrade/status/[taskNo]`：真实成功任务、真实失败任务均已验证

### 当前已知限制 / 风险

- 本地数据库里存在一个历史 active 渠道 `987ai`，导致失败和重试场景会继续尝试额外渠道，attempt 数量不能按“纯净环境”精确断言，只能按最终状态和关键副作用断言。
- 直接在脚本中调用后台 route handler 时，`requirePermission()` 会触发 Next `unstable_cache` 的运行时告警；但接口仍返回了预期的 `无权限`。这说明“接口保护逻辑”已验证，但不等同于“完整 Next 运行时 + 登录态”下的后台页面联调。
- 未覆盖真实 `987ai` 网络联调、真实 access token、Docker 独立 Worker 长稳压测。
