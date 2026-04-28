import assert from 'node:assert/strict';
import test from 'node:test';
import { and, eq, inArray, like } from 'drizzle-orm';

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

async function seedPendingTask(
  prefix: string,
  drivers: { first: string; second: string }
) {
  const taskId = uid(`${prefix}_task`);
  const taskNo = `${prefix}-TASK`;
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const redeemCodePlain = `${prefix}-SITE-CODE`;
  const firstChannelId = uid(`${prefix}_ch1`);
  const secondChannelId = uid(`${prefix}_ch2`);
  const firstCardkeyId = uid(`${prefix}_ck1`);
  const secondCardkeyId = uid(`${prefix}_ck2`);

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

  await db()
    .insert(upgradeTask)
    .values({
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

  await db()
    .insert(upgradeChannel)
    .values([
      {
        id: firstChannelId,
        code: `${prefix}-9977`,
        name: `${prefix} 9977`,
        driver: drivers.first,
        supportedProducts: 'plus',
        status: 'active',
        priority: 1,
        requiresCardkey: true,
      },
      {
        id: secondChannelId,
        code: `${prefix}-backup`,
        name: `${prefix} backup`,
        driver: drivers.second,
        supportedProducts: 'plus',
        status: 'active',
        priority: 2,
        requiresCardkey: true,
      },
    ]);

  await db()
    .insert(channelCardkey)
    .values([
      {
        id: firstCardkeyId,
        channelId: firstChannelId,
        cardkey: `${prefix}-9977-CARD`,
        productCode: 'plus',
        memberType: 'month',
        status: 'available',
      },
      {
        id: secondCardkeyId,
        channelId: secondChannelId,
        cardkey: `${prefix}-BACKUP-CARD`,
        productCode: 'plus',
        memberType: 'month',
        status: 'available',
      },
    ]);

  return {
    taskId,
    taskNo,
    redeemCodeId,
    firstChannelId,
    secondChannelId,
    firstCardkeyId,
    secondCardkeyId,
  };
}

test('pickAndRunTasks 遇到 9977 型终止失败时不再尝试下一个渠道，且保留本站卡密与渠道卡密占用', async () => {
  const prefix = `reg9977stop${Date.now()}`;
  await cleanupByPrefix(prefix);

  let backupCalled = false;
  registerAdapter(`${prefix}_9977_stop`, {
    execute: async () => ({
      ok: false as const,
      retryable: false,
      message: '9977 渠道存在历史升级记录，需人工处理',
      stopFallback: true,
      preserveRedeemCode: true,
      cardkeyAction: 'consume' as const,
    }),
  });
  registerAdapter(`${prefix}_backup_success`, {
    execute: async () => {
      backupCalled = true;
      return { ok: true as const, message: 'backup success' };
    },
  });

  const seeded = await seedPendingTask(prefix, {
    first: `${prefix}_9977_stop`,
    second: `${prefix}_backup_success`,
  });

  try {
    const processed = await pickAndRunTasks(1);
    assert.equal(processed, 1);
    assert.equal(backupCalled, false);

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(taskRow.status, UpgradeTaskStatus.FAILED);
    assert.equal(taskRow.attemptCount, 1);
    assert.match(taskRow.lastError || '', /人工处理/);

    const [redeemRow] = await db()
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, seeded.redeemCodeId));
    assert.equal(redeemRow.status, 'consumed');
    assert.equal(redeemRow.usedByTaskId, seeded.taskId);

    const [firstCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.firstCardkeyId));
    const [secondCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.secondCardkeyId));
    assert.equal(firstCardkeyRow.status, 'used');
    assert.equal(secondCardkeyRow.status, 'available');

    const attempts = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.taskId, seeded.taskId));
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].channelId, seeded.firstChannelId);

    await assert.rejects(
      retryTask(seeded.taskId),
      /该任务需人工处理，不能直接重试/
    );

    const [failedTaskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(failedTaskRow.status, UpgradeTaskStatus.FAILED);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('pickAndRunTasks 对普通失败仍会释放卡密并切换到下一个渠道', async () => {
  const prefix = `reg9977fallback${Date.now()}`;
  await cleanupByPrefix(prefix);

  let backupCalled = false;
  registerAdapter(`${prefix}_fail_release`, {
    execute: async () => ({
      ok: false as const,
      retryable: true,
      message: '普通网络失败',
    }),
  });
  registerAdapter(`${prefix}_backup_success`, {
    execute: async () => {
      backupCalled = true;
      return { ok: true as const, message: 'backup success' };
    },
  });

  const seeded = await seedPendingTask(prefix, {
    first: `${prefix}_fail_release`,
    second: `${prefix}_backup_success`,
  });

  try {
    const processed = await pickAndRunTasks(1);
    assert.equal(processed, 1);
    assert.equal(backupCalled, true);

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(taskRow.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(taskRow.attemptCount, 2);
    assert.equal(taskRow.successChannelId, seeded.secondChannelId);

    const [firstCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.firstCardkeyId));
    const [secondCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.secondCardkeyId));
    assert.equal(firstCardkeyRow.status, 'available');
    assert.equal(secondCardkeyRow.status, 'used');

    const attempts = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.taskId, seeded.taskId));
    assert.equal(attempts.length, 2);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('pickAndRunTasks 遇到 9977 无充值记录失败时保留人工处理但释放渠道卡密', async () => {
  const prefix = `reg9977norecord${Date.now()}`;
  await cleanupByPrefix(prefix);

  let backupCalled = false;
  registerAdapter(`${prefix}_9977_no_record`, {
    execute: async () => ({
      ok: false as const,
      retryable: false,
      message:
        '9977 渠道充值异常：submit_json 失败后自动复用 3 次仍未成功：未找到对应的充值记录',
      stopFallback: true,
      preserveRedeemCode: true,
      cardkeyAction: 'release' as const,
    }),
  });
  registerAdapter(`${prefix}_backup_success`, {
    execute: async () => {
      backupCalled = true;
      return { ok: true as const, message: 'backup success' };
    },
  });

  const seeded = await seedPendingTask(prefix, {
    first: `${prefix}_9977_no_record`,
    second: `${prefix}_backup_success`,
  });

  try {
    const processed = await pickAndRunTasks(1);
    assert.equal(processed, 1);
    assert.equal(backupCalled, false);

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, seeded.taskId));
    assert.equal(taskRow.status, UpgradeTaskStatus.FAILED);
    assert.equal(taskRow.attemptCount, 1);
    assert.match(taskRow.lastError || '', /未找到对应的充值记录/);

    const [redeemRow] = await db()
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, seeded.redeemCodeId));
    assert.equal(redeemRow.status, 'consumed');
    assert.equal(redeemRow.usedByTaskId, seeded.taskId);

    const [firstCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.firstCardkeyId));
    const [secondCardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, seeded.secondCardkeyId));
    assert.equal(firstCardkeyRow.status, 'available');
    assert.equal(firstCardkeyRow.lockedByTaskId, null);
    assert.equal(secondCardkeyRow.status, 'available');

    await assert.rejects(
      retryTask(seeded.taskId),
      /该任务需人工处理，不能直接重试/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});
