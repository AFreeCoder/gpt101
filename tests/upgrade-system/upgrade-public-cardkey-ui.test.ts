import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('upgrade flow distinguishes successful and manual-required consumed cardkeys', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );

  assert.match(source, /该卡密已使用，升级已成功/);
  assert.match(
    source,
    /如未生效，登录 ChatGPT 账号后，点击升级 Plus 即可触发状态更新/
  );
  assert.doesNotMatch(source, /你可以核对以下升级信息/);
  assert.match(source, /该卡密已提交升级，当前充值异常待客服处理/);
  assert.match(source, /UpgradeTaskSummary/);
  assert.doesNotMatch(
    source,
    /href=\{`\/upgrade\/status\/\$\{redeemCodeTask\.taskNo\}`\}/
  );
  assert.doesNotMatch(source, /redeemCodeTask\.status === 'succeeded' &&/);
});

test('upgrade status view reuses the public task summary fields', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-status-view.tsx'),
    'utf8'
  );

  assert.match(source, /UpgradeTaskSummary/);
  assert.match(source, /chatgptEmail/);
  assert.match(source, /chatgptCurrentPlan/);
});

test('upgrade task summary keeps only essential successful upgrade fields', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-task-summary.tsx'),
    'utf8'
  );

  assert.match(source, /任务编号/);
  assert.match(source, /客户邮箱/);
  assert.match(source, /升级会员/);
  assert.match(source, /完成时间/);
  assert.doesNotMatch(source, /提交前会员状态/);
  assert.doesNotMatch(source, /提交时间/);
});
