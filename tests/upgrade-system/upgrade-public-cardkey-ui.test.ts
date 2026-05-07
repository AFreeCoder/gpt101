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
  assert.match(source, /该卡密已提交升级，当前充值异常待客服处理/);
  assert.match(source, /UpgradeTaskSummary/);
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
