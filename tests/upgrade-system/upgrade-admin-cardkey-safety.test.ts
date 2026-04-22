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
import {
  cancelTask,
  markTaskSuccess,
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

async function seedManualRequiredFailedTask(prefix: string) {
  const taskId = uid(`${prefix}_task`);
  const taskNo = `${prefix}-TASK`;
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);

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
    code: `${prefix}-SITE-CODE`,
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
    redeemCodePlain: `${prefix}-SITE-CODE`,
    productCode: 'plus',
    memberType: 'month',
    sessionToken: '{}',
    chatgptEmail: 'user@example.com',
    chatgptAccountId: 'account_123',
    chatgptCurrentPlan: 'free',
    status: UpgradeTaskStatus.FAILED,
    lastError: '9977 渠道充值异常：该卡密已存在历史升级记录，需人工处理',
    metadata: JSON.stringify({
      manualRequired: true,
      manualRequiredReason: '9977 渠道充值异常：该卡密已存在历史升级记录，需人工处理',
    }),
  });

  return { taskId, redeemCodeId };
}

async function seedManualSuccessCase(prefix: string) {
  const taskId = uid(`${prefix}_task`);
  const taskNo = `${prefix}-TASK`;
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const channelId = uid(`${prefix}_channel`);
  const channelCardkeyId = uid(`${prefix}_card`);
  const manualCardkey = `${prefix}-CHANNEL-CARD`;

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
    code: `${prefix}-SITE-CODE`,
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
    redeemCodePlain: `${prefix}-SITE-CODE`,
    productCode: 'plus',
    memberType: 'month',
    sessionToken: '{}',
    chatgptEmail: 'user@example.com',
    chatgptAccountId: 'account_123',
    chatgptCurrentPlan: 'free',
    status: UpgradeTaskStatus.FAILED,
    lastError: '需要人工补单',
  });

  await db().insert(upgradeChannel).values({
    id: channelId,
    code: `${prefix}-manual-channel`,
    name: `${prefix} manual channel`,
    driver: 'mock',
    supportedProducts: 'plus',
    status: 'disabled',
    priority: 1,
    requiresCardkey: true,
  });

  await db().insert(channelCardkey).values({
    id: channelCardkeyId,
    channelId,
    cardkey: manualCardkey,
    productCode: 'plus',
    memberType: 'month',
    status: 'available',
  });

  return {
    taskId,
    channelId,
    channelCardkeyId,
    manualCardkey,
  };
}

async function seedChannelOnly(prefix: string) {
  const channelId = uid(`${prefix}_channel`);

  await db().insert(upgradeChannel).values({
    id: channelId,
    code: `${prefix}-channel`,
    name: `${prefix} channel`,
    driver: 'mock',
    supportedProducts: 'plus',
    status: 'disabled',
    priority: 1,
    requiresCardkey: true,
  });

  return { channelId };
}

test('manualRequired 失败任务不能取消，且本站卡密继续保持占用', async () => {
  const prefix = `manualcancel${Date.now()}`;
  await cleanupByPrefix(prefix);

  const seeded = await seedManualRequiredFailedTask(prefix);

  try {
    await assert.rejects(
      cancelTask(seeded.taskId),
      /需人工处理/
    );

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    const [redeemRow] = await db()
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, seeded.redeemCodeId));

    assert.equal(taskRow.status, UpgradeTaskStatus.FAILED);
    assert.equal(redeemRow.status, 'consumed');
    assert.equal(redeemRow.usedByTaskId, seeded.taskId);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('人工标记成功时，会把选中的渠道卡密标记为已使用并回填任务', async () => {
  const prefix = `manualsuccess${Date.now()}`;
  await cleanupByPrefix(prefix);

  const seeded = await seedManualSuccessCase(prefix);

  try {
    await markTaskSuccess(seeded.taskId, {
      channelId: seeded.channelId,
      channelCardkey: seeded.manualCardkey,
      note: 'admin success',
    });

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    const [cardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.channelCardkeyId));

    assert.equal(taskRow.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(taskRow.successChannelId, seeded.channelId);
    assert.equal(taskRow.successChannelCardkeyId, seeded.channelCardkeyId);
    assert.equal(cardkeyRow.status, 'used');
    assert.ok(cardkeyRow.usedAt instanceof Date);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('同一渠道下重复插入相同卡密会被数据库唯一约束拒绝', async () => {
  const prefix = `dupcard${Date.now()}`;
  await cleanupByPrefix(prefix);

  const seeded = await seedChannelOnly(prefix);
  const duplicatedCardkey = `${prefix}-DUPLICATED-CARD`;

  try {
    await db().insert(channelCardkey).values({
      id: uid(`${prefix}_card1`),
      channelId: seeded.channelId,
      cardkey: duplicatedCardkey,
      productCode: 'plus',
      memberType: 'month',
      status: 'available',
    });

    await assert.rejects(
      db().insert(channelCardkey).values({
        id: uid(`${prefix}_card2`),
        channelId: seeded.channelId,
        cardkey: duplicatedCardkey,
        productCode: 'plus',
        memberType: 'month',
        status: 'available',
      })
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});
