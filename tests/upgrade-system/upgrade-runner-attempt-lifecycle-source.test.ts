import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const runnerPath = path.join(
  process.cwd(),
  'src/extensions/upgrade-channel/runner.ts'
);

test('runner 先创建 running attempt，再执行 adapter，并在完成后更新同一条记录', () => {
  const source = fs.readFileSync(runnerPath, 'utf8');
  const runningInsertIndex = source.indexOf("status: 'running'");
  const adapterExecuteIndex = source.indexOf('adapter.execute(req)');
  const finalUpdateIndex = source.indexOf('.update(upgradeTaskAttempt)');
  const attemptIdWhereIndex = source.indexOf(
    'eq(upgradeTaskAttempt.id, attemptId)'
  );

  assert.notEqual(runningInsertIndex, -1);
  assert.notEqual(adapterExecuteIndex, -1);
  assert.notEqual(finalUpdateIndex, -1);
  assert.notEqual(attemptIdWhereIndex, -1);
  assert.ok(
    runningInsertIndex < adapterExecuteIndex,
    'running attempt should be inserted before adapter.execute starts'
  );
  assert.ok(
    adapterExecuteIndex < finalUpdateIndex,
    'final attempt update should happen after adapter.execute finishes'
  );
  assert.ok(
    finalUpdateIndex < attemptIdWhereIndex,
    'final update should target the existing attempt row'
  );
});
