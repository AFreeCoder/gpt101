# 升级任务结果页按卡密收敛设计

## 结论

这个优化合理，但不应该长期依赖 `/admin/upgrade-tasks` 列表查询做分组聚合。

业务语义应收敛为：一张本站卡密对应一个升级任务，渠道执行过程写入 `upgrade_task_attempt`。如果用户升级失败后在用户侧点击“重试升级”，系统应复用原 `upgrade_task`，把它重置为 `pending`，并继续把新的渠道尝试写入 `upgrade_task_attempt`。

## 根因

后台任务结果页的“重试”调用 `retryTask(taskId)`，它只更新同一条 `upgrade_task`，不会新增任务。

重复任务真正来自用户侧流程：失败后如果渠道结果允许释放本站卡密，`pickAndRunTasks()` 会调用 `rollbackCode()`，把本站卡密恢复为 `available`。用户页面的“重试升级”会再次调用 `/api/upgrade/submit`，旧的 `submitUpgradeTask()` 每次提交都会新建一条 `upgrade_task`，于是同一卡密出现多条任务结果。

## 目标行为

- 用户侧重复提交同一张已释放卡密时，如果已有失败或取消的 `upgrade_task`，复用原任务。
- 复用时返回原 `taskNo`，避免生成新的任务编号。
- 复用时更新最新的 Session Token、账号信息、客户端信息，并清空旧错误、完成时间、成功渠道。
- `upgrade_task_attempt` 保留所有过程记录；同一任务下的新 attempt 编号基于已有最大 `attempt_no` 继续递增。
- `/admin/upgrade-tasks` 恢复普通查询，不在高频列表请求中做窗口聚合。

## 非目标

- 本次不自动清理生产历史重复任务。历史数据需要单独用一次性脚本按卡密归并或隐藏旧任务。
- 本次不新增 `upgrade_task.redeem_code_id` 唯一约束。等历史数据清理完成后，再评估加唯一索引。

## 实施方案

1. 修改 `submitUpgradeTask()`：
   - 在事务内锁定 `redeem_code`。
   - 如果卡密可用，先查同一 `redeem_code_id` 下状态为 `failed` 或 `canceled` 的最新任务。
   - 若找到且不是 `manualRequired`，把本站卡密重新标记为 `consumed`，`usedByTaskId` 指向原任务。
   - 更新原 `upgrade_task` 为 `pending`，清空旧执行结果，返回原 `taskNo`。
   - 若没有可复用任务，按首次提交逻辑创建新任务。
2. 修改 `runTask()`：
   - 读取当前任务已有最大 `attempt_no`。
   - 新一轮执行从最大值之后继续编号，避免复用任务后 attempt 页出现多个 `1`。
3. 修改 `getTaskList()`：
   - 移除窗口聚合，恢复按任务表普通过滤、排序、分页。

## 测试方案

- 新增 `submitUpgradeTask()` 回归测试：同一卡密已有失败任务且卡密已释放时，再次提交返回原 `taskNo`，任务表仍只有一条，并把原任务重置为 `pending`。
- 保留已有任务结果页和 attempt 页源码测试。
