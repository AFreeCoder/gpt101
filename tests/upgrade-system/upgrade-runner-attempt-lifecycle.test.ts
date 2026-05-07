import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, inArray, like } from 'drizzle-orm';

import {
  channelCardkey,
  upgradeChannel,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import { registerAdapter } from '../../src/extensions/upgrade-channel/registry';
import { runTask } from '../../src/extensions/upgrade-channel/runner';
import type { UpgradeResult } from '../../src/extensions/upgrade-channel/types';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function failAfter(ms: number, message: string) {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

async function cleanupByPrefix(prefix: string, taskId: string) {
  const tx = db();
  const [channelRows, cardkeyRows] = await Promise.all([
    tx
      .select({ id: upgradeChannel.id })
      .from(upgradeChannel)
      .where(like(upgradeChannel.code, `${prefix}%`)),
    tx
      .select({ id: channelCardkey.id })
      .from(channelCardkey)
      .where(like(channelCardkey.cardkey, `${prefix}%`)),
  ]);

  const channelIds = channelRows.map((row: { id: string }) => row.id);
  const cardkeyIds = cardkeyRows.map((row: { id: string }) => row.id);

  await tx
    .delete(upgradeTaskAttempt)
    .where(eq(upgradeTaskAttempt.taskId, taskId));
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
}

test('runTask 选中渠道卡密并开始执行时立即创建 running attempt，完成后更新同一条记录', async () => {
  const prefix = `regattemptlive${Date.now()}`;
  const taskId = uid(`${prefix}_task`);
  const channelId = uid(`${prefix}_channel`);
  const cardkeyId = uid(`${prefix}_cardkey`);
  const driver = `${prefix}_driver`;
  const productCode = `${prefix}_plus`;
  const memberType = 'month';

  await cleanupByPrefix(prefix, taskId);

  let resolveExecuteStarted!: () => void;
  const executeStarted = new Promise<void>((resolve) => {
    resolveExecuteStarted = resolve;
  });
  let resolveExecute!: (result: UpgradeResult) => void;
  const executeResult = new Promise<UpgradeResult>((resolve) => {
    resolveExecute = resolve;
  });

  registerAdapter(driver, {
    execute: async ({ channelCardkey }) => {
      assert.equal(channelCardkey, `${prefix}-CARD`);
      resolveExecuteStarted();
      return executeResult;
    },
  });

  await db()
    .insert(upgradeChannel)
    .values({
      id: channelId,
      code: `${prefix}-channel`,
      name: `${prefix} channel`,
      driver,
      supportedProducts: productCode,
      status: 'active',
      priority: 1,
      requiresCardkey: true,
    });
  await db()
    .insert(channelCardkey)
    .values({
      id: cardkeyId,
      channelId,
      cardkey: `${prefix}-CARD`,
      productCode,
      memberType,
      status: 'available',
    });

  try {
    const runPromise = runTask({
      taskId,
      productCode,
      memberType,
      sessionToken: JSON.stringify({
        user: { id: 'user_123', email: 'user@example.com' },
        account: { id: 'account_123', planType: 'free' },
        accessToken: 'header.payload.signature',
      }),
      chatgptEmail: 'user@example.com',
    });

    await Promise.race([
      executeStarted,
      failAfter(1000, 'adapter.execute was not reached'),
    ]);

    const runningAttempts = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.taskId, taskId));
    assert.equal(runningAttempts.length, 1);
    assert.equal(runningAttempts[0].status, 'running');
    assert.equal(runningAttempts[0].channelId, channelId);
    assert.equal(runningAttempts[0].channelCardkeyId, cardkeyId);
    assert.equal(runningAttempts[0].attemptNo, 1);
    assert.equal(runningAttempts[0].durationMs, null);
    assert.equal(runningAttempts[0].finishedAt, null);

    resolveExecute({ ok: true, message: 'upgrade success' });
    const result = await runPromise;

    assert.equal(result.success, true);

    const finishedAttempts = await db()
      .select()
      .from(upgradeTaskAttempt)
      .where(eq(upgradeTaskAttempt.taskId, taskId));
    assert.equal(finishedAttempts.length, 1);
    assert.equal(finishedAttempts[0].id, runningAttempts[0].id);
    assert.equal(finishedAttempts[0].status, 'success');
    assert.equal(finishedAttempts[0].errorMessage, null);
    assert.ok((finishedAttempts[0].durationMs ?? -1) >= 0);
    assert.ok(finishedAttempts[0].finishedAt);

    const [usedCardkey] = await db()
      .select()
      .from(channelCardkey)
      .where(eq(channelCardkey.id, cardkeyId));
    assert.equal(usedCardkey.status, 'used');
    assert.equal(usedCardkey.usedByAttemptId, runningAttempts[0].id);
  } finally {
    await cleanupByPrefix(prefix, taskId);
  }
});
