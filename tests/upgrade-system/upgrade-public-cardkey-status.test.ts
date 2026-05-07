import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, inArray, like } from 'drizzle-orm';

import { POST as verifyCodePost } from '../../src/app/api/upgrade/verify-code/route';
import {
  redeemCode,
  redeemCodeBatch,
  upgradeTask,
  upgradeTaskAttempt,
} from '../../src/config/db/schema';
import { db } from '../../src/core/db';
import {
  queryTaskStatus,
  UpgradeTaskStatus,
  verifyRedeemCode,
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

async function seedConsumedTask(args: {
  prefix: string;
  status: UpgradeTaskStatus;
  email: string;
  currentPlan: string;
  metadata?: Record<string, unknown>;
}) {
  const taskId = uid(`${args.prefix}_task`);
  const taskNo = `${args.prefix}-TASK`;
  const batchId = `${args.prefix}-BATCH`;
  const redeemCodeId = uid(`${args.prefix}_code`);
  const code = makeRedeemCode(args.prefix);
  const now = new Date();

  await db()
    .insert(redeemCodeBatch)
    .values({
      id: batchId,
      title: `${args.prefix}-batch-title`,
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
    status: 'consumed',
    usedByTaskId: taskId,
    usedAt: now,
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
      sessionToken: '{}',
      chatgptEmail: args.email,
      chatgptAccountId: `${args.prefix}_account`,
      chatgptCurrentPlan: args.currentPlan,
      status: args.status,
      resultMessage:
        args.status === UpgradeTaskStatus.SUCCEEDED ? '管理员已标记成功' : null,
      lastError:
        args.status === UpgradeTaskStatus.FAILED ? '需要人工处理' : null,
      metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
      finishedAt:
        args.status === UpgradeTaskStatus.SUCCEEDED ||
        args.status === UpgradeTaskStatus.FAILED
          ? now
          : null,
    });

  return { taskId, taskNo, code };
}

test('verifyRedeemCode 对已成功使用的本站卡密返回公开任务摘要', async () => {
  const prefix = `pubsuccess${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedConsumedTask({
    prefix,
    status: UpgradeTaskStatus.SUCCEEDED,
    email: 'success@example.com',
    currentPlan: 'free',
  });

  try {
    const result = await verifyRedeemCode(seeded.code);

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'already_succeeded');
    assert.equal(result.task?.taskNo, seeded.taskNo);
    assert.equal(result.task?.status, UpgradeTaskStatus.SUCCEEDED);
    assert.equal(result.task?.chatgptEmail, 'success@example.com');
    assert.equal(result.task?.chatgptCurrentPlan, 'free');
    assert.equal(result.task?.productCode, 'gpt');
    assert.equal(result.task?.memberType, 'plus');
    assert.equal(result.task?.manualRequired, false);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('verifyRedeemCode 对人工处理失败的占用卡密不返回已使用语义', async () => {
  const prefix = `pubmanual${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedConsumedTask({
    prefix,
    status: UpgradeTaskStatus.FAILED,
    email: 'manual@example.com',
    currentPlan: 'free',
    metadata: {
      manualRequired: true,
      manualRequiredReason: '9977 渠道充值异常，需人工处理',
    },
  });

  try {
    const result = await verifyRedeemCode(seeded.code);

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'manual_required');
    assert.equal(result.task?.taskNo, seeded.taskNo);
    assert.equal(result.task?.status, UpgradeTaskStatus.FAILED);
    assert.equal(result.task?.manualRequired, true);
    assert.equal(result.task?.chatgptEmail, 'manual@example.com');
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('queryTaskStatus 返回成功任务的邮箱和会员摘要', async () => {
  const prefix = `pubstatus${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedConsumedTask({
    prefix,
    status: UpgradeTaskStatus.SUCCEEDED,
    email: 'status@example.com',
    currentPlan: 'free',
  });

  try {
    const status = await queryTaskStatus(seeded.taskNo);

    assert.equal(status?.taskNo, seeded.taskNo);
    assert.equal(status?.chatgptEmail, 'status@example.com');
    assert.equal(status?.chatgptCurrentPlan, 'free');
    assert.equal(status?.productCode, 'gpt');
    assert.equal(status?.memberType, 'plus');
    assert.equal(status?.manualRequired, false);
  } finally {
    await cleanupByPrefix(prefix);
  }
});

test('verify-code API 对已成功卡密返回详情而不是错误', async () => {
  const prefix = `pubapi${Date.now()}`;
  await cleanupByPrefix(prefix);
  const seeded = await seedConsumedTask({
    prefix,
    status: UpgradeTaskStatus.SUCCEEDED,
    email: 'api-success@example.com',
    currentPlan: 'free',
  });

  try {
    const response = await verifyCodePost(
      new Request('http://localhost/api/upgrade/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: seeded.code }),
      })
    );
    const payload = await response.json();

    assert.equal(payload.code, 0);
    assert.equal(payload.data.valid, false);
    assert.equal(payload.data.reason, 'already_succeeded');
    assert.equal(payload.data.task.chatgptEmail, 'api-success@example.com');
  } finally {
    await cleanupByPrefix(prefix);
  }
});
