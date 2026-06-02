import assert from 'node:assert/strict';
import test from 'node:test';
import { inArray, like } from 'drizzle-orm';

import {
  redeemCode,
  redeemCodeBatch,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import {
  maskRedeemCodeUsagePublicResult,
  normalizeRedeemCodeBatchInput,
  queryRedeemCodeUsageBatch,
} from '../../src/shared/models/redeem-code';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      .where(like(redeemCode.code, `${prefix}%`)),
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

test('批量查询输入会去掉空行、统一大写并限制最多 100 个卡密', () => {
  const normalized = normalizeRedeemCodeBatchInput([
    ' gpt101-lower-code ',
    '',
    'GPT101-UPPER-CODE',
  ]);

  assert.deepEqual(normalized, ['GPT101-LOWER-CODE', 'GPT101-UPPER-CODE']);

  assert.throws(
    () =>
      normalizeRedeemCodeBatchInput(
        Array.from({ length: 101 }, (_, i) => `GPT101-${i}`)
      ),
    /最多查询 100 个卡密/
  );
});

test('公开批量查询结果会脱敏使用者邮箱但保留状态统计', () => {
  const result = maskRedeemCodeUsagePublicResult({
    items: [
      {
        code: 'GPT101-USED',
        state: 'used',
        used: true,
        status: 'consumed',
        productCode: 'gpt',
        memberType: 'plus',
        usedAt: new Date('2026-06-02T10:20:30.000Z'),
        usedByEmail: 'used@example.com',
      },
      {
        code: 'GPT101-SHORT',
        state: 'used',
        used: true,
        status: 'consumed',
        productCode: 'gpt',
        memberType: 'plus',
        usedAt: new Date('2026-06-02T10:20:30.000Z'),
        usedByEmail: 'a@b.com',
      },
      {
        code: 'GPT101-EMPTY',
        state: 'unused',
        used: false,
        status: 'available',
        productCode: 'gpt',
        memberType: 'plus',
        usedAt: null,
        usedByEmail: null,
      },
    ],
    summary: {
      total: 3,
      used: 2,
      unused: 1,
      disabled: 0,
      notFound: 0,
    },
  });

  assert.deepEqual(
    result.items.map((item) => item.usedByEmail),
    ['us***@example.com', 'a***@b.com', null]
  );
  assert.deepEqual(result.summary, {
    total: 3,
    used: 2,
    unused: 1,
    disabled: 0,
    notFound: 0,
  });
});

test('批量查询本站卡密会按输入顺序返回使用状态、使用时间和使用者邮箱', async () => {
  const prefix = `batchquery${Date.now()}`;
  await cleanupByPrefix(prefix);

  const batchId = `${prefix}-BATCH`;
  const consumedCode = `${prefix}-USED-CODE`;
  const availableCode = `${prefix}-AVAILABLE-CODE`;
  const disabledCode = `${prefix}-DISABLED-CODE`;
  const missingCode = `${prefix}-MISSING-CODE`;
  const taskId = uid(`${prefix}_task`);
  const usedAt = new Date('2026-05-26T10:20:30.000Z');

  try {
    await db()
      .insert(redeemCodeBatch)
      .values({
        id: batchId,
        title: `${prefix}-batch-title`,
        productCode: 'plus',
        memberType: 'month',
        count: 3,
        unitPrice: '0.00',
      });

    await db()
      .insert(redeemCode)
      .values([
        {
          id: uid(`${prefix}_used_code`),
          batchId,
          code: consumedCode,
          productCode: 'plus',
          memberType: 'month',
          status: 'consumed',
          usedByTaskId: taskId,
          usedAt,
        },
        {
          id: uid(`${prefix}_available_code`),
          batchId,
          code: availableCode,
          productCode: 'plus',
          memberType: 'month',
          status: 'available',
        },
        {
          id: uid(`${prefix}_disabled_code`),
          batchId,
          code: disabledCode,
          productCode: 'plus',
          memberType: 'month',
          status: 'disabled',
        },
      ]);

    await db()
      .insert(upgradeTask)
      .values({
        id: taskId,
        taskNo: `${prefix}-TASK`,
        redeemCodeId: uid(`${prefix}_external_code_id`),
        redeemCodePlain: consumedCode,
        productCode: 'plus',
        memberType: 'month',
        sessionToken: '{}',
        chatgptEmail: 'used@example.com',
        chatgptAccountId: 'account_123',
        chatgptCurrentPlan: 'free',
        status: 'succeeded',
      });

    const result = await queryRedeemCodeUsageBatch([
      ` ${availableCode.toLowerCase()} `,
      consumedCode,
      missingCode,
      disabledCode,
      consumedCode,
    ]);

    assert.deepEqual(
      result.items.map((item) => item.code),
      [availableCode, consumedCode, missingCode, disabledCode, consumedCode]
    );
    assert.deepEqual(result.summary, {
      total: 5,
      used: 2,
      unused: 1,
      disabled: 1,
      notFound: 1,
    });

    const usedRows = result.items.filter((item) => item.state === 'used');
    assert.equal(usedRows.length, 2);
    assert.ok(usedRows.every((item) => item.used === true));
    assert.ok(
      usedRows.every(
        (item) => item.usedAt?.toISOString() === usedAt.toISOString()
      )
    );
    assert.ok(
      usedRows.every((item) => item.usedByEmail === 'used@example.com')
    );

    assert.equal(result.items[0].state, 'unused');
    assert.equal(result.items[0].used, false);
    assert.equal(result.items[2].state, 'not_found');
    assert.equal(result.items[3].state, 'disabled');
  } finally {
    await cleanupByPrefix(prefix);
  }
});
