import assert from 'node:assert/strict';
import { eq, inArray, like } from 'drizzle-orm';

import { databaseTest } from '../helpers/database-test';

import {
  channelCardkey,
  redeemCode,
  redeemCodeBatch,
  upgradeChannel,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import { registerAdapter } from '../../src/extensions/upgrade-channel/registry';
import {
  recoverStaleRunningTasks,
  UpgradeTaskStatus,
} from '../../src/shared/services/upgrade-task';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupByPrefix(prefix: string) {
  const tx = db();
  const [taskRows, channelRows, batchRows, codeRows, cardkeyRows] =
    await Promise.all([
      tx
        .select({ id: upgradeTask.id })
        .from(upgradeTask)
        .where(like(upgradeTask.taskNo, `${prefix}%`)),
      tx
        .select({ id: upgradeChannel.id })
        .from(upgradeChannel)
        .where(like(upgradeChannel.code, `${prefix}%`)),
      tx
        .select({ id: redeemCodeBatch.id })
        .from(redeemCodeBatch)
        .where(like(redeemCodeBatch.id, `${prefix}%`)),
      tx
        .select({ id: redeemCode.id })
        .from(redeemCode)
        .where(like(redeemCode.code, `${prefix}%`)),
      tx
        .select({ id: channelCardkey.id })
        .from(channelCardkey)
        .where(like(channelCardkey.cardkey, `${prefix}%`)),
    ]);

  const taskIds = taskRows.map((row: { id: string }) => row.id);
  const channelIds = channelRows.map((row: { id: string }) => row.id);
  const batchIds = batchRows.map((row: { id: string }) => row.id);
  const codeIds = codeRows.map((row: { id: string }) => row.id);
  const cardkeyIds = cardkeyRows.map((row: { id: string }) => row.id);

  if (taskIds.length > 0) {
    await tx
      .delete(upgradeTaskAttempt)
      .where(inArray(upgradeTaskAttempt.taskId, taskIds));
    await tx.delete(upgradeTask).where(inArray(upgradeTask.id, taskIds));
  }
  if (cardkeyIds.length > 0) {
    await tx
      .delete(channelCardkey)
      .where(inArray(channelCardkey.id, cardkeyIds));
  }
  if (channelIds.length > 0) {
    await tx
      .delete(upgradeChannel)
      .where(inArray(upgradeChannel.id, channelIds));
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

databaseTest('recoverStaleRunningTasks 用已有 running attempt 的渠道卡确认成功，不重新执行充值', async () => {
  const prefix = `regrunrecover${Date.now()}`;
  await cleanupByPrefix(prefix);

  const now = new Date('2026-05-29T04:00:00Z');
  const startedAt = new Date(now.getTime() - 20 * 60 * 1000);
  const taskId = uid(`${prefix}_task`);
  const taskNo = `${prefix}-TASK`;
  const attemptId = uid(`${prefix}_attempt`);
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const channelId = uid(`${prefix}_channel`);
  const lockedCardkeyId = uid(`${prefix}_locked`);
  const spareCardkeyId = uid(`${prefix}_spare`);
  const driver = `${prefix}_driver`;

  let executeCalled = false;
  let recoverCalled = false;

  registerAdapter(driver, {
    execute: async () => {
      executeCalled = true;
      throw new Error('execute should not be called during running recovery');
    },
    recoverRunningAttempt: async (req) => {
      recoverCalled = true;
      assert.equal(req.taskId, taskId);
      assert.equal(req.channelCardkey, `${prefix}-LOCKED-CARD`);
      assert.equal(req.chatgptEmail, 'user@example.com');
      assert.equal(req.attemptStartedAt.getTime(), startedAt.getTime());
      return {
        ok: true as const,
        message: '二次查卡确认已充值成功',
      };
    },
  });

  await db()
    .insert(redeemCodeBatch)
    .values({
      id: batchId,
      title: `${prefix}-batch-title`,
      productCode: 'plus',
      memberType: 'month',
      count: 1,
      unitPrice: '0.00',
    });

  await db()
    .insert(redeemCode)
    .values({
      id: redeemCodeId,
      batchId,
      code: `${prefix}-SITE-CODE`,
      productCode: 'plus',
      memberType: 'month',
      status: 'consumed',
      usedByTaskId: taskId,
      usedAt: startedAt,
    });

  await db()
    .insert(upgradeTask)
    .values({
      id: taskId,
      taskNo,
      redeemCodeId,
      redeemCodePlain: `${prefix}-SITE-CODE`,
      productCode: 'plus',
      memberType: 'month',
      sessionToken: JSON.stringify({
        user: { id: 'user_123', email: 'user@example.com' },
        account: { id: 'account_123', planType: 'free' },
        accessToken: 'header.payload.signature',
      }),
      chatgptEmail: 'user@example.com',
      chatgptAccountId: 'account_123',
      chatgptCurrentPlan: 'free',
      status: UpgradeTaskStatus.RUNNING,
      startedAt,
    });

  await db()
    .insert(upgradeChannel)
    .values({
      id: channelId,
      code: `${prefix}-channel`,
      name: `${prefix} channel`,
      driver,
      supportedProducts: 'plus',
      status: 'active',
      priority: 1,
      requiresCardkey: true,
    });

  await db()
    .insert(channelCardkey)
    .values([
      {
        id: lockedCardkeyId,
        channelId,
        cardkey: `${prefix}-LOCKED-CARD`,
        productCode: 'plus',
        memberType: 'month',
        status: 'locked',
        lockedByTaskId: taskId,
      },
      {
        id: spareCardkeyId,
        channelId,
        cardkey: `${prefix}-SPARE-CARD`,
        productCode: 'plus',
        memberType: 'month',
        status: 'available',
      },
    ]);

  await db().insert(upgradeTaskAttempt).values({
    id: attemptId,
    taskId,
    channelId,
    channelCardkeyId: lockedCardkeyId,
    attemptNo: 1,
    status: 'running',
    startedAt,
  });

  try {
    const recovered = await recoverStaleRunningTasks(5, {
      now: () => now,
      staleAfterMs: 10 * 60 * 1000,
    });
    assert.equal(recovered, 1);
    assert.equal(executeCalled, false);
    assert.equal(recoverCalled, true);

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, taskId));
    assert.equal(taskRow.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(taskRow.successChannelId, channelId);
    assert.equal(taskRow.successChannelCardkeyId, lockedCardkeyId);
    assert.equal(taskRow.resultMessage, '二次查卡确认已充值成功');
    assert.equal(taskRow.lastError, null);
    assert.ok(taskRow.finishedAt);

    const [attemptRow] = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.id, attemptId));
    assert.equal(attemptRow.status, 'success');
    assert.equal(attemptRow.errorMessage, null);
    assert.ok((attemptRow.durationMs ?? -1) >= 20 * 60 * 1000);
    assert.ok(attemptRow.finishedAt);

    const [lockedCardkey] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, lockedCardkeyId));
    assert.equal(lockedCardkey.status, 'used');
    assert.equal(lockedCardkey.lockedByTaskId, null);
    assert.equal(lockedCardkey.usedByAttemptId, attemptId);
    assert.ok(lockedCardkey.usedAt);

    const [spareCardkey] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, spareCardkeyId));
    assert.equal(spareCardkey.status, 'available');
  } finally {
    await cleanupByPrefix(prefix);
  }
});
