import assert from 'node:assert/strict';
import { inArray, like } from 'drizzle-orm';

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
import {
  createManualUpgradeTask,
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
  const codePrefix = `GPT101-${prefix.toUpperCase()}%`;
  const [taskRows, channelRows, batchRows, codeRows, cardkeyRows] =
    await Promise.all([
      tx
        .select({ id: upgradeTask.id })
        .from(upgradeTask)
        .where(like(upgradeTask.redeemCodePlain, codePrefix)),
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
        .where(like(redeemCode.code, codePrefix)),
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

async function seedManualEntryInventory(prefix: string) {
  const batchId = `${prefix}-BATCH`;
  const redeemCodeId = uid(`${prefix}_code`);
  const code = makeRedeemCode(prefix);
  const channelId = uid(`${prefix}_channel`);
  const channelCardkeyId = uid(`${prefix}_card`);
  const manualChannelCardkey = `${prefix}-CHANNEL-CARD`;

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
    code,
    productCode: 'plus',
    memberType: 'month',
    status: 'available',
  });

  await db()
    .insert(upgradeChannel)
    .values({
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
    cardkey: manualChannelCardkey,
    productCode: 'plus',
    memberType: 'month',
    status: 'available',
  });

  return {
    code,
    redeemCodeId,
    channelId,
    channelCardkeyId,
    manualChannelCardkey,
  };
}

databaseTest('后台任务补录会创建成功任务并占用本站卡密和上游渠道卡密', async () => {
  const prefix = `manualentry${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedManualEntryInventory(prefix);
  const sessionToken = JSON.stringify({
    user: { id: 'manual_user', email: 'manual@example.com' },
    account: { id: 'manual_account', planType: 'free' },
    accessToken: 'manual-access-token',
  });

  try {
    const result = await createManualUpgradeTask({
      redeemCode: seeded.code.toLowerCase(),
      sessionToken,
      chatgptEmail: 'offline@example.com',
      channelId: seeded.channelId,
      channelCardkey: seeded.manualChannelCardkey,
      note: '线下升级补录',
    });

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(like(upgradeTask.taskNo, result.taskNo));
    const [redeemRow] = await db()
      .select()
      .from(redeemCode)
      .where(like(redeemCode.code, seeded.code));
    const [cardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(like(channelCardkey.cardkey, seeded.manualChannelCardkey));

    assert.equal(taskRow.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(taskRow.redeemCodePlain, seeded.code);
    assert.equal(taskRow.chatgptEmail, 'offline@example.com');
    assert.equal(taskRow.chatgptAccountId, 'manual_account');
    assert.equal(taskRow.chatgptCurrentPlan, 'free');
    assert.equal(taskRow.sessionToken, sessionToken);
    assert.equal(taskRow.successChannelId, seeded.channelId);
    assert.equal(taskRow.successChannelCardkeyId, seeded.channelCardkeyId);
    assert.equal(redeemRow.status, 'consumed');
    assert.equal(redeemRow.usedByTaskId, taskRow.id);
    assert.equal(cardkeyRow.status, 'used');
    assert.equal(cardkeyRow.usedByAttemptId, null);
    assert.ok(cardkeyRow.usedAt instanceof Date);

    const metadata = JSON.parse(taskRow.metadata || '{}');
    assert.equal(metadata.manualEntry, true);
    assert.equal(metadata.adminNote, '线下升级补录');
    assert.equal(
      metadata.manualSuccessChannelCardkey,
      seeded.manualChannelCardkey
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

databaseTest('后台任务补录支持已禁用的本站卡密和上游渠道卡密', async () => {
  const prefix = `manualdisabled${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedManualEntryInventory(prefix);
  const sessionToken = JSON.stringify({
    user: { id: 'disabled_manual_user', email: 'disabled@example.com' },
    account: { id: 'disabled_manual_account', planType: 'free' },
    accessToken: 'disabled-manual-access-token',
  });

  try {
    await db()
      .update(redeemCode)
      .set({
        status: 'disabled',
        disabledReason: '线下升级预占，避免误用',
        disabledAt: new Date(),
      })
      .where(like(redeemCode.code, seeded.code));
    await db()
      .update(channelCardkey)
      .set({
        status: 'disabled',
        disabledReason: '线下升级预占，避免误用',
      })
      .where(like(channelCardkey.cardkey, seeded.manualChannelCardkey));

    const result = await createManualUpgradeTask({
      redeemCode: seeded.code,
      sessionToken,
      chatgptEmail: 'offline-disabled@example.com',
      channelId: seeded.channelId,
      channelCardkey: seeded.manualChannelCardkey,
      note: '禁用卡密线下升级补录',
    });

    const [taskRow] = await db()
      .select()
      .from(upgradeTask)
      .where(like(upgradeTask.taskNo, result.taskNo));
    const [redeemRow] = await db()
      .select()
      .from(redeemCode)
      .where(like(redeemCode.code, seeded.code));
    const [cardkeyRow] = await db()
      .select()
      .from(channelCardkey)
      .where(like(channelCardkey.cardkey, seeded.manualChannelCardkey));

    assert.equal(taskRow.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(taskRow.chatgptEmail, 'offline-disabled@example.com');
    assert.equal(taskRow.successChannelCardkeyId, seeded.channelCardkeyId);
    assert.equal(redeemRow.status, 'consumed');
    assert.equal(redeemRow.usedByTaskId, taskRow.id);
    assert.equal(cardkeyRow.status, 'used');
    assert.equal(cardkeyRow.usedByAttemptId, null);

    const metadata = JSON.parse(taskRow.metadata || '{}');
    assert.equal(metadata.manualEntry, true);
    assert.equal(metadata.manualEntryRedeemCodeOriginalStatus, 'disabled');
    assert.equal(metadata.manualEntryChannelCardkeyOriginalStatus, 'disabled');
  } finally {
    await cleanupByPrefix(prefix);
  }
});

databaseTest('后台任务补录拒绝已使用状态的上游渠道卡密', async () => {
  const prefix = `manualusedcard${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedManualEntryInventory(prefix);

  try {
    await db()
      .update(channelCardkey)
      .set({
        status: 'used',
        usedAt: new Date(),
      })
      .where(like(channelCardkey.cardkey, seeded.manualChannelCardkey));

    await assert.rejects(
      () =>
        createManualUpgradeTask({
          redeemCode: seeded.code,
          sessionToken: '{}',
          chatgptEmail: 'offline@example.com',
          channelId: seeded.channelId,
          channelCardkey: seeded.manualChannelCardkey,
        }),
      /该渠道卡密已标记为已使用/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

databaseTest('后台任务补录拒绝已使用但未绑定任务的本站卡密', async () => {
  const prefix = `manualconsumed${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedManualEntryInventory(prefix);

  try {
    await db()
      .update(redeemCode)
      .set({
        status: 'consumed',
        usedByTaskId: null,
        usedAt: new Date(),
      })
      .where(like(redeemCode.code, seeded.code));

    await assert.rejects(
      () =>
        createManualUpgradeTask({
          redeemCode: seeded.code,
          sessionToken: '{}',
          chatgptEmail: 'offline@example.com',
          channelId: seeded.channelId,
          channelCardkey: seeded.manualChannelCardkey,
        }),
      /该卡密已被使用/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});

databaseTest('后台任务补录拒绝已被其他任务占用的本站卡密', async () => {
  const prefix = `manualdup${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedManualEntryInventory(prefix);
  const existingTaskId = uid(`${prefix}_existing_task`);

  try {
    await db()
      .insert(upgradeTask)
      .values({
        id: existingTaskId,
        taskNo: `${prefix}-TASK`,
        redeemCodeId: seeded.redeemCodeId,
        redeemCodePlain: seeded.code,
        productCode: 'plus',
        memberType: 'month',
        sessionToken: '{}',
        chatgptEmail: 'used@example.com',
        status: UpgradeTaskStatus.SUCCEEDED,
      });
    await db()
      .update(redeemCode)
      .set({
        status: 'consumed',
        usedByTaskId: existingTaskId,
        usedAt: new Date(),
      })
      .where(like(redeemCode.code, seeded.code));

    await assert.rejects(
      () =>
        createManualUpgradeTask({
          redeemCode: seeded.code,
          sessionToken: '{}',
          chatgptEmail: 'offline@example.com',
          channelId: seeded.channelId,
          channelCardkey: seeded.manualChannelCardkey,
        }),
      /本站卡密已被其他任务占用/
    );
  } finally {
    await cleanupByPrefix(prefix);
  }
});
