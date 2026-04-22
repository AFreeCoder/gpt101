import assert from 'node:assert/strict';
import test from 'node:test';

import { eq, inArray, like } from 'drizzle-orm';

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
  pickAndRunTasks,
  retryTask,
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

  const taskIds = taskRows.map((row) => row.id);
  const channelIds = channelRows.map((row) => row.id);
  const batchIds = batchRows.map((row) => row.id);
  const codeIds = codeRows.map((row) => row.id);
  const cardkeyIds = cardkeyRows.map((row) => row.id);

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

async function seedSingleChannelRetryCase(prefix: string, driver: string) {
  const taskId = uid(`${prefix}_task`);
  const taskNo = `${prefix}-TASK`;
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const redeemCodePlain = `${prefix}-SITE-CODE`;
  const channelId = uid(`${prefix}_channel`);
  const badCardkeyId = uid(`${prefix}_bad`);
  const goodCardkeyId = uid(`${prefix}_good`);

  await db().insert(redeemCodeBatch).values({
    id: batchId,
    title: `${prefix}-batch-title`,
    productCode: 'plus',
    memberType: 'month',
    count: 1,
    unitPrice: '0.00',
  });

  await db().insert(redeemCode).values({
    id: redeemCodeId,
    batchId,
    code: redeemCodePlain,
    productCode: 'plus',
    memberType: 'month',
    status: 'consumed',
    usedByTaskId: taskId,
    usedAt: new Date(),
  });

  await db().insert(upgradeTask).values({
    id: taskId,
    taskNo,
    redeemCodeId,
    redeemCodePlain,
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
    status: UpgradeTaskStatus.PENDING,
  });

  await db().insert(upgradeChannel).values({
    id: channelId,
    code: `${prefix}-987ai`,
    name: `${prefix} 987ai`,
    driver,
    supportedProducts: 'plus',
    status: 'active',
    priority: 1,
    requiresCardkey: true,
  });

  await db().insert(channelCardkey).values([
    {
      id: badCardkeyId,
      channelId,
      cardkey: `${prefix}-BAD-CARD`,
      productCode: 'plus',
      memberType: 'month',
      status: 'available',
    },
    {
      id: goodCardkeyId,
      channelId,
      cardkey: `${prefix}-GOOD-CARD`,
      productCode: 'plus',
      memberType: 'month',
      status: 'available',
    },
  ]);

  return {
    taskId,
    redeemCodeId,
    channelId,
    badCardkeyId,
    goodCardkeyId,
  };
}

test('坏卡失败后会被禁用，retry 不会再次命中同一张坏卡', async () => {
  const prefix = `regbadcard${Date.now()}`;
  await cleanupByPrefix(prefix);

  registerAdapter(`${prefix}_bad_then_good`, {
    execute: async ({ channelCardkey }) => {
      if (channelCardkey === `${prefix}-BAD-CARD`) {
        return {
          ok: false as const,
          retryable: false,
          message: '渠道卡密不可用: 卡密已被使用',
          cardkeyAction: 'disable' as const,
        };
      }

      if (channelCardkey === `${prefix}-GOOD-CARD`) {
        return {
          ok: true as const,
          message: 'upgrade success',
        };
      }

      throw new Error(`unexpected channel cardkey: ${channelCardkey}`);
    },
  });

  const seeded = await seedSingleChannelRetryCase(
    prefix,
    `${prefix}_bad_then_good`
  );

  try {
    const firstProcessed = await pickAndRunTasks(1);
    assert.equal(firstProcessed, 1);

    const [failedTask] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(failedTask.status, UpgradeTaskStatus.FAILED);

    const [badCardkeyAfterFail] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.badCardkeyId));
    const [goodCardkeyAfterFail] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.goodCardkeyId));
    assert.equal(badCardkeyAfterFail.status, 'disabled');
    assert.equal(
      badCardkeyAfterFail.disabledReason,
      '渠道卡密不可用: 卡密已被使用'
    );
    assert.equal(goodCardkeyAfterFail.status, 'available');

    await retryTask(seeded.taskId);
    const secondProcessed = await pickAndRunTasks(1);
    assert.equal(secondProcessed, 1);

    const [retriedTask] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(retriedTask.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(retriedTask.successChannelId, seeded.channelId);
    assert.equal(retriedTask.successChannelCardkeyId, seeded.goodCardkeyId);

    const attempts = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.taskId, seeded.taskId));
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].channelCardkeyId, seeded.badCardkeyId);
    assert.equal(attempts[1].channelCardkeyId, seeded.goodCardkeyId);
  } finally {
    await cleanupByPrefix(prefix);
  }
});
