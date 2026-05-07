import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql = readFileSync(
  new URL(
    '../../scripts/sql/upgrade-task-duplicates-merge.sql',
    import.meta.url
  ),
  'utf8'
);

test('历史升级任务治理 SQL 默认 dry-run，提交需要显式 apply=true', () => {
  assert.match(sql, /\\if\s+:apply/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /ROLLBACK;/);
});

test('历史升级任务治理 SQL 只自动归并低风险重复组', () => {
  assert.match(sql, /active_count\s*=\s*0/);
  assert.match(sql, /manual_required_count\s*=\s*0/);
  assert.match(sql, /succeeded_count\s*<=\s*1/);
  assert.match(sql, /non_success_cardkey_count\s*=\s*0/);
  assert.match(sql, /locked_cardkey_count\s*=\s*0/);
});

test('历史升级任务治理 SQL 保留 attempt 记录并删除被归并任务行', () => {
  assert.match(sql, /UPDATE\s+upgrade_task_attempt/i);
  assert.match(sql, /SET\s+task_id\s*=\s*m\.canonical_task_id/i);
  assert.match(sql, /attempt_no\s*=\s*m\.new_attempt_no/i);
  assert.match(sql, /UPDATE\s+redeem_code/i);
  assert.match(sql, /DELETE\s+FROM\s+upgrade_task/i);
});
