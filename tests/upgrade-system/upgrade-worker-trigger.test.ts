import assert from 'node:assert/strict';
import test from 'node:test';

import { queueUpgradeTaskProcessing } from '../../src/shared/services/upgrade-worker-trigger';

test('queueUpgradeTaskProcessing 会在后台异步触发 worker，并吞掉执行异常', async () => {
  const calls: number[] = [];

  queueUpgradeTaskProcessing(1, async (maxCount) => {
    calls.push(maxCount);
    throw new Error('boom');
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, [1]);
});
