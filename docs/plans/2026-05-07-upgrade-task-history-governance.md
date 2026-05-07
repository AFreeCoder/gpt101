# 升级任务历史重复数据治理方案

## 目标

把历史上同一张本站卡密对应的多条 `upgrade_task` 收敛为一条任务结果记录，同时保留 `upgrade_task_attempt` 中的过程记录。

## 生产现状

2026-05-07 在 silicon 生产库只读盘点结果：

- 重复本站卡密：13 张
- 涉及 `upgrade_task`：76 条
- 状态分布：13 条 `succeeded`，63 条 `failed`
- 风险组：1 组包含 `manualRequired=true` 的历史失败任务，不自动归并

## 治理规则

自动归并只处理低风险重复组：

- 同一 `redeem_code_id` 下没有 `pending` / `running` 任务。
- 没有 `metadata.manualRequired=true` 的任务。
- 最多一条 `succeeded` 任务。
- 所有任务都是 `succeeded` / `failed` / `canceled` 终态。
- 非成功任务没有 `success_channel_cardkey_id`。
- 没有渠道卡密仍锁定到该组内任务。

保留任务选择：

- 如果该组有一条成功任务，保留成功任务。
- 如果没有成功任务，保留最近完成或最近更新的终态任务。

归并动作：

- 把旧任务的 `upgrade_task_attempt.task_id` 改到保留任务。
- 将迁移过去的 attempt 编号接在保留任务现有最大 `attempt_no` 之后。
- 如果 `redeem_code.status='consumed'` 且 `used_by_task_id` 为空或指向旧任务，改为指向保留任务。
- 删除已归并的旧 `upgrade_task` 行。

## 回滚姿态

执行生产治理前先用 `pg_dump` 做一次完整数据库备份。治理 SQL 默认 dry-run，只有显式传入 `-v apply=true` 才会 `COMMIT`。

当前脚本：

- 审计：`scripts/sql/upgrade-task-duplicates-audit.sql`
- 归并：`scripts/sql/upgrade-task-duplicates-merge.sql`

执行顺序：

```bash
docker exec -i gpt101-postgres psql -U "$DB_USER" -d "$DB_NAME" -f scripts/sql/upgrade-task-duplicates-audit.sql
docker exec -i gpt101-postgres psql -U "$DB_USER" -d "$DB_NAME" -v apply=false -f scripts/sql/upgrade-task-duplicates-merge.sql
pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > pre-upgrade-task-governance.sql.gz
docker exec -i gpt101-postgres psql -U "$DB_USER" -d "$DB_NAME" -v apply=true -f scripts/sql/upgrade-task-duplicates-merge.sql
```

## 实际执行结果

自动治理先归并 12 个低风险重复组，迁移 271 条 attempt，删除 57 条旧失败任务行。

剩余 1 个包含 `manualRequired=true` 的重复组随后做了人工复核：

- 本站卡密：`GPT101-R1GOKINVLOICDQZPNNLC7QJQV84YKDB0`
- 保留任务：`TS-20260506-1813`
- 复核依据：7 条任务都是同一个 ChatGPT 邮箱和账号，保留任务已由管理员标记成功；旧失败任务没有绑定成功渠道卡密，过程可以通过 attempts 保留。
- 人工归并结果：迁移 37 条 attempt，删除 6 条旧失败任务行。

最终生产库核验结果：

- `upgrade_task` 按 `redeem_code_id` 分组重复数：0
- 孤儿 `upgrade_task_attempt`：0
- 同一任务下重复 `attempt_no`：0
- 示例卡密 `GPT101-9J6HNYSRM9IUTJL6U06P9ZSK6SWLKRLI` 只保留成功任务 `TS-20260507-8710`，attempt 编号 1-36。
- 人工复核卡密 `GPT101-R1GOKINVLOICDQZPNNLC7QJQV84YKDB0` 只保留成功任务 `TS-20260506-1813`，attempt 编号 1-44。
