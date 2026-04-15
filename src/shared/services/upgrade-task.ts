import { and, count, desc, eq, isNull, lte, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { redeemCode, upgradeTask } from '@/config/db/schema';
import { runTask } from '@/extensions/upgrade-channel/runner';
import { getUuid } from '@/shared/lib/hash';
import {
  consumeCode,
  markCodeConsumed,
  rollbackCode,
} from '@/shared/models/redeem-code';
import { getChannelById } from '@/shared/models/upgrade-channel';
import { resolveVerifiedSessionAccount } from '@/shared/services/upgrade-account-resolver';
import {
  mergeUpgradeTaskMetadata,
  parseUpgradeTaskMetadata,
} from '@/shared/services/upgrade-task-helpers';

export type UpgradeTask = typeof upgradeTask.$inferSelect;

export enum UpgradeTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

function getRedeemCodeErrorMessage(reason: string): string {
  const messages: Record<string, string> = {
    not_found: '卡密不存在',
    disabled: '该卡密已被禁用',
    already_consumed: '该卡密已被使用',
  };

  return messages[reason] || '卡密不可用';
}

// --- 生成任务编号 ---

function generateTaskNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `TS-${date}-${rand}`;
}

// --- Step 1: 验证卡密 ---

export async function verifyRedeemCode(code: string): Promise<{
  valid: boolean;
  productCode?: string;
  memberType?: string;
  reason?: string;
}> {
  const { getCodeByCode } = await import('@/shared/models/redeem-code');
  const row = await getCodeByCode(code);

  if (!row) return { valid: false, reason: 'not_found' };
  if (row.status === 'disabled') return { valid: false, reason: 'disabled' };
  if (row.status === 'consumed')
    return { valid: false, reason: 'already_used' };

  return {
    valid: true,
    productCode: row.productCode,
    memberType: row.memberType,
  };
}

// --- Step 2: 解析 session token ---

export async function resolveAccount(sessionToken: string): Promise<{
  email: string;
  accountId: string;
  currentPlan?: string;
  accessToken?: string;
}> {
  return resolveVerifiedSessionAccount(sessionToken);
}

// --- Step 3: 提交升级任务 ---

export async function submitUpgradeTask(req: {
  code: string;
  sessionToken: string;
  chatgptEmail: string;
  chatgptAccountId?: string;
  chatgptCurrentPlan?: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, string>;
}): Promise<{ taskNo: string }> {
  const taskId = getUuid();
  const taskNo = generateTaskNo();
  const account = await resolveVerifiedSessionAccount(req.sessionToken);

  await db().transaction(async (tx: any) => {
    // 锁定卡密
    const result = await consumeCode(tx, req.code, taskId);
    if (!result.ok) {
      throw new Error(getRedeemCodeErrorMessage(result.reason));
    }

    // 创建任务
    await tx.insert(upgradeTask).values({
      id: taskId,
      taskNo,
      redeemCodeId: result.codeId,
      redeemCodePlain: req.code.toUpperCase(),
      productCode: result.productCode,
      memberType: result.memberType,
      sessionToken: req.sessionToken,
      chatgptEmail: account.email,
      chatgptAccountId: account.accountId,
      chatgptCurrentPlan: account.currentPlan,
      status: UpgradeTaskStatus.PENDING,
      clientIp: req.clientIp,
      userAgent: req.userAgent,
      metadata: req.metadata ? JSON.stringify(req.metadata) : undefined,
    });
  });

  return { taskNo };
}

// --- 用户查询 ---

export interface PublicTaskStatus {
  taskNo: string;
  status: string;
  message: string;
  createdAt: Date;
  finishedAt?: Date | null;
}

export async function queryTaskStatus(
  taskNo: string
): Promise<PublicTaskStatus | null> {
  const [task] = await db()
    .select({
      taskNo: upgradeTask.taskNo,
      status: upgradeTask.status,
      lastError: upgradeTask.lastError,
      createdAt: upgradeTask.createdAt,
      finishedAt: upgradeTask.finishedAt,
    })
    .from(upgradeTask)
    .where(eq(upgradeTask.taskNo, taskNo));

  if (!task) return null;

  const messages: Record<string, string> = {
    pending: '升级任务已提交，正在排队处理...',
    running: '正在为您升级，请稍候...',
    succeeded: '升级成功！请刷新您的 ChatGPT 页面查看。',
    failed: '充值异常，请联系客服处理。',
    canceled: '任务已取消。',
  };

  return {
    taskNo: task.taskNo,
    status: task.status,
    message: messages[task.status] || '未知状态',
    createdAt: task.createdAt,
    finishedAt: task.finishedAt,
  };
}

// --- Worker: 拉取和执行任务 ---

export async function pickAndRunTasks(maxCount: number = 5): Promise<number> {
  let processed = 0;

  for (let i = 0; i < maxCount; i++) {
    const task = await db().transaction(async (tx: any) => {
      const [pendingTask] = await tx
        .select()
        .from(upgradeTask)
        .where(eq(upgradeTask.status, UpgradeTaskStatus.PENDING))
        .orderBy(upgradeTask.createdAt)
        .limit(1)
        .for('update', { skipLocked: true });

      if (!pendingTask) return null;

      await tx
        .update(upgradeTask)
        .set({
          status: UpgradeTaskStatus.RUNNING,
          startedAt: new Date(),
          lastError: null,
          finishedAt: null,
          resultMessage: null,
        })
        .where(eq(upgradeTask.id, pendingTask.id));

      return pendingTask as UpgradeTask;
    });

    if (!task) break;

    // 执行升级
    try {
      const result = await runTask({
        taskId: task.id,
        productCode: task.productCode,
        memberType: task.memberType,
        sessionToken: task.sessionToken,
        chatgptEmail: task.chatgptEmail,
      });

      if (result.success) {
        await db()
          .update(upgradeTask)
          .set({
            status: UpgradeTaskStatus.SUCCEEDED,
            successChannelId: result.channelId,
            successChannelCardkeyId: result.channelCardkeyId,
            attemptCount: result.attempts.length,
            resultMessage: result.message || '升级成功',
            finishedAt: new Date(),
          })
          .where(eq(upgradeTask.id, task.id));

        // 标记本站卡密为已消费
        await markCodeConsumed(task.redeemCodeId);
      } else {
        const nextMetadata = result.preserveRedeemCode
          ? mergeUpgradeTaskMetadata(task.metadata, {
              manualRequired: true,
              manualRequiredReason: result.error,
            })
          : task.metadata;

        await db()
          .update(upgradeTask)
          .set({
            status: UpgradeTaskStatus.FAILED,
            lastError: result.error,
            attemptCount: result.attempts.length,
            resultMessage: null,
            metadata: nextMetadata,
            finishedAt: new Date(),
          })
          .where(eq(upgradeTask.id, task.id));

        if (!result.preserveRedeemCode) {
          // 失败：回滚本站卡密
          await rollbackCode(task.redeemCodeId);
        }
      }
    } catch (err: any) {
      await db()
        .update(upgradeTask)
        .set({
          status: UpgradeTaskStatus.FAILED,
          lastError: err.message,
          resultMessage: null,
          finishedAt: new Date(),
        })
        .where(eq(upgradeTask.id, task.id));

      await rollbackCode(task.redeemCodeId);
    }

    processed++;
  }

  return processed;
}

// --- 管理后台查询 ---

export async function getTaskList(args: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}) {
  const { page = 1, pageSize = 20 } = args;
  const offset = (page - 1) * pageSize;
  const conditions = [];

  if (args.status) conditions.push(eq(upgradeTask.status, args.status));
  if (args.search) {
    // 支持按卡密或邮箱搜索
    conditions.push(
      sql`(${upgradeTask.redeemCodePlain} = ${args.search} OR ${upgradeTask.chatgptEmail} = ${args.search} OR ${upgradeTask.taskNo} = ${args.search})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db()
    .select()
    .from(upgradeTask)
    .where(where)
    .orderBy(desc(upgradeTask.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db()
    .select({ total: count() })
    .from(upgradeTask)
    .where(where);

  return { items, total };
}

export async function getTaskById(taskId: string) {
  const [task] = await db()
    .select()
    .from(upgradeTask)
    .where(eq(upgradeTask.id, taskId));
  return task || null;
}

// --- 管理员操作 ---

export async function markTaskSuccess(
  taskId: string,
  input?: {
    channelId?: string;
    channelCardkey?: string;
    note?: string;
  }
) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Task not found');
  if (task.status === UpgradeTaskStatus.SUCCEEDED) {
    throw new Error('任务已经是成功状态');
  }

  let channelName: string | undefined;
  if (input?.channelId) {
    const channel = await getChannelById(input.channelId);
    if (!channel) {
      throw new Error('渠道不存在');
    }
    channelName = channel.name;
  }

  await db()
    .update(upgradeTask)
    .set({
      status: UpgradeTaskStatus.SUCCEEDED,
      finishedAt: new Date(),
      lastError: null,
      successChannelId: input?.channelId || task.successChannelId,
      resultMessage: '管理员已标记成功',
      metadata: mergeUpgradeTaskMetadata(task.metadata, {
        adminNote: input?.note,
        manualSuccessChannelId: input?.channelId,
        manualSuccessChannelName: channelName,
        manualSuccessChannelCardkey: input?.channelCardkey,
      }),
    })
    .where(eq(upgradeTask.id, taskId));

  await markCodeConsumed(task.redeemCodeId);
}

export async function retryTask(taskId: string) {
  await db().transaction(async (tx: any) => {
    const [task] = await tx
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, taskId))
      .limit(1)
      .for('update');

    if (!task) throw new Error('Task not found');
    if (
      ![UpgradeTaskStatus.FAILED, UpgradeTaskStatus.CANCELED].includes(
        task.status as UpgradeTaskStatus
      )
    ) {
      throw new Error('仅失败或已取消的任务可以重试');
    }

    const metadata = parseUpgradeTaskMetadata(task.metadata);
    if (metadata.manualRequired) {
      throw new Error('该任务需人工处理，不能直接重试');
    }

    const [code] = await tx
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.id, task.redeemCodeId))
      .limit(1)
      .for('update');

    if (!code) throw new Error('Redeem code not found');
    if (code.status === 'disabled') {
      throw new Error('该卡密已被禁用，无法重试');
    }
    if (code.status === 'consumed' && code.usedByTaskId !== task.id) {
      throw new Error('该卡密已被其他任务占用，无法重试');
    }

    await tx
      .update(redeemCode)
      .set({
        status: 'consumed',
        usedByTaskId: task.id,
        usedAt: new Date(),
      })
      .where(eq(redeemCode.id, code.id));

    await tx
      .update(upgradeTask)
      .set({
        status: UpgradeTaskStatus.PENDING,
        lastError: null,
        resultMessage: null,
        startedAt: null,
        finishedAt: null,
        successChannelId: null,
        successChannelCardkeyId: null,
      })
      .where(eq(upgradeTask.id, taskId));
  });
}

export async function cancelTask(taskId: string, reason?: string) {
  await db().transaction(async (tx: any) => {
    const [task] = await tx
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, taskId))
      .limit(1)
      .for('update');

    if (!task) throw new Error('Task not found');
    if (task.status === UpgradeTaskStatus.SUCCEEDED) {
      throw new Error('成功任务不能取消');
    }
    if (task.status === UpgradeTaskStatus.CANCELED) {
      return;
    }
    if (
      ![UpgradeTaskStatus.PENDING, UpgradeTaskStatus.FAILED].includes(
        task.status as UpgradeTaskStatus
      )
    ) {
      throw new Error('仅排队中或失败任务可以取消');
    }

    await tx
      .update(upgradeTask)
      .set({
        status: UpgradeTaskStatus.CANCELED,
        lastError: reason || 'Canceled by admin',
        resultMessage: null,
        finishedAt: new Date(),
      })
      .where(eq(upgradeTask.id, taskId));

    await tx
      .update(redeemCode)
      .set({
        status: 'available',
        usedByTaskId: null,
        usedAt: null,
      })
      .where(eq(redeemCode.id, task.redeemCodeId));
  });
}
