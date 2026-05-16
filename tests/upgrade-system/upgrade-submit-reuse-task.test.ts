import assert from 'node:assert/strict';
import test from 'node:test';
import { count, eq, inArray, like } from 'drizzle-orm';

import {
  redeemCode,
  redeemCodeBatch,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import {
  submitUpgradeTask,
  UpgradeTaskStatus,
} from '../../src/shared/services/upgrade-task';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeRedeemCode(prefix: string) {
  const normalized = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(32, 'X')
    .slice(0, 32);
  return `GPT101-${normalized}`;
}

async function cleanupByPrefix(prefix: string) {
  const tx = db();
  const [taskRows, batchRows, codeRows] = await Promise.all([
    tx
      .select({ id: upgradeTask.id })
      .from(upgradeTask)
      .where(like(upgradeTask.taskNo, `${prefix}%`)),
    tx
      .select({ id: redeemCodeBatch.id })
      .from(redeemCodeBatch)
      .where(like(redeemCodeBatch.id, `${prefix}%`)),
    tx
      .select({ id: redeemCode.id })
      .from(redeemCode)
      .where(like(redeemCode.code, `GPT101-${prefix.toUpperCase()}%`)),
  ]);

  const taskIds = taskRows.map((row: { id: string }) => row.id);
  const batchIds = batchRows.map((row: { id: string }) => row.id);
  const codeIds = codeRows.map((row: { id: string }) => row.id);

  if (taskIds.length > 0) {
    await tx
      .delete(upgradeTaskAttempt)
      .where(inArray(upgradeTaskAttempt.taskId, taskIds));
    await tx.delete(upgradeTask).where(inArray(upgradeTask.id, taskIds));
  }
  if (codeIds.length > 0) {
    await tx.delete(redeemCode).where(inArray(redeemCode.id, codeIds));
  }
  if (batchIds.length > 0) {
    await tx
      .delete(redeemCodeBatch)
      .where(inArray(redeemCodeBatch.id, batchIds));
  }
}

async function seedReleasedFailedTask(prefix: string) {
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const code = makeRedeemCode(prefix);
  const taskId = uid(`${prefix}_failed_task`);
  const taskNo = `${prefix}-TASK-FAILED`;

  await db()
    .insert(redeemCodeBatch)
    .values({
      id: batchId,
      title: `${prefix}-batch-title`,
      productCode: 'gpt',
      memberType: 'plus',
      count: 1,
      unitPrice: '0.00',
    });

  await db().insert(redeemCode).values({
    id: redeemCodeId,
    batchId,
    code,
    productCode: 'gpt',
    memberType: 'plus',
    status: 'available',
  });

  await db()
    .insert(upgradeTask)
    .values({
      id: taskId,
      taskNo,
      redeemCodeId,
      redeemCodePlain: code,
      productCode: 'gpt',
      memberType: 'plus',
      sessionToken: '{"old":true}',
      chatgptEmail: 'old@example.com',
      chatgptAccountId: `${prefix}_old_account`,
      chatgptCurrentPlan: 'free',
      status: UpgradeTaskStatus.FAILED,
      attemptCount: 1,
      lastError: '历史失败',
      createdAt: new Date('2026-05-07T09:00:00.000Z'),
      updatedAt: new Date('2026-05-07T09:00:00.000Z'),
      finishedAt: new Date('2026-05-07T09:01:00.000Z'),
    });

  return { code, redeemCodeId, taskId, taskNo };
}

test('submitUpgradeTask 复用同一卡密已释放的失败任务', async () => {
  const prefix = `submitreuse${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedReleasedFailedTask(prefix);
  const submittedSession = JSON.stringify({
    user: { id: 'submitted_user', email: 'submitted@example.com' },
    account: { id: 'submitted_account', planType: 'plus' },
    accessToken: 'submitted-access-token',
  });

  try {
    const result = await submitUpgradeTask(
      {
        code: seeded.code,
        sessionToken: submittedSession,
        chatgptEmail: 'ignored@example.com',
        chatgptAccountId: 'ignored_account',
        chatgptCurrentPlan: 'free',
        clientIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      {
        accountResolver: async () => ({
          email: 'retry@example.com',
          accountId: 'retry_account',
          currentPlan: 'free',
          accessToken: 'test-access-token',
        }),
      }
    );

    const [taskTotal] = await db()
      .select({ value: count() })
      .from(upgradeTask)
      .where(eq(upgradeTask.redeemCodeId, seeded.redeemCodeId));
    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    const [codeRow] = await db()
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, seeded.redeemCodeId));

    assert.equal(result.taskNo, seeded.taskNo);
    assert.equal(taskTotal.value, 1);
    assert.equal(taskRow.status, UpgradeTaskStatus.PENDING);
    assert.deepEqual(JSON.parse(taskRow.sessionToken), {
      user: { id: 'submitted_user', email: 'submitted@example.com' },
      account: { id: 'submitted_account', planType: 'free' },
      accessToken: 'submitted-access-token',
    });
    assert.equal(taskRow.chatgptEmail, 'retry@example.com');
    assert.equal(taskRow.chatgptAccountId, 'retry_account');
    assert.equal(taskRow.attemptCount, 0);
    assert.equal(taskRow.lastError, null);
    assert.equal(taskRow.finishedAt, null);
    assert.equal(codeRow.status, 'consumed');
    assert.equal(codeRow.usedByTaskId, seeded.taskId);
  } finally {
    await cleanupByPrefix(prefix);
  }
});
