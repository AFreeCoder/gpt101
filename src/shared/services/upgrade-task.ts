import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { channelCardkey, redeemCode, upgradeTask } from '@/config/db/schema';
import { runTask } from '@/extensions/upgrade-channel/runner';
import { dbTimestampNow } from '@/shared/lib/db-time';
import { getUuid } from '@/shared/lib/hash';
import { ChannelCardkeyStatus as ChannelInventoryStatus } from '@/shared/models/channel-cardkey';
import {
  markCodeConsumed,
  RedeemCodeStatus,
  rollbackCode,
} from '@/shared/models/redeem-code';
import { getChannelById } from '@/shared/models/upgrade-channel';
import { resolveVerifiedSessionAccount } from '@/shared/services/upgrade-account-resolver';
import {
  mergeUpgradeTaskMetadata,
  parseUpgradeTaskMetadata,
  type ResolvedSessionAccount,
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
  task?: PublicTaskStatus;
}> {
  const { getCodeByCode } = await import('@/shared/models/redeem-code');
  const row = await getCodeByCode(code);

  if (!row) return { valid: false, reason: 'not_found' };
  if (row.status === 'disabled') return { valid: false, reason: 'disabled' };
  if (row.status === 'consumed') {
    const task = await getPublicTaskStatusForRedeemCode(
      row.id,
      row.usedByTaskId
    );

    return {
      valid: false,
      productCode: row.productCode,
      memberType: row.memberType,
      reason: getConsumedRedeemCodeReason(task),
      task: task || undefined,
    };
  }

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

export async function submitUpgradeTask(
  req: {
    code: string;
    sessionToken: string;
    chatgptEmail: string;
    chatgptAccountId?: string;
    chatgptCurrentPlan?: string;
    clientIp?: string;
    userAgent?: string;
    metadata?: Record<string, string>;
  },
  options?: {
    accountResolver?: (sessionToken: string) => Promise<ResolvedSessionAccount>;
  }
): Promise<{ taskNo: string }> {
  const newTaskId = getUuid();
  const newTaskNo = generateTaskNo();
  const accountResolver =
    options?.accountResolver || resolveVerifiedSessionAccount;
  const account = await accountResolver(req.sessionToken);
  let taskNo = newTaskNo;

  await db().transaction(async (tx: any) => {
    const normalizedCode = req.code.toUpperCase();
    const [code] = await tx
      .select()
      .from(redeemCode)
      .where(eq(redeemCode.code, normalizedCode))
      .limit(1)
      .for('update');

    if (!code) throw new Error(getRedeemCodeErrorMessage('not_found'));
    if (code.status === RedeemCodeStatus.DISABLED) {
      throw new Error(getRedeemCodeErrorMessage('disabled'));
    }
    if (code.status === RedeemCodeStatus.CONSUMED) {
      throw new Error(getRedeemCodeErrorMessage('already_consumed'));
    }

    const [reusableTask] = await tx
      .select()
      .from(upgradeTask)
      .where(
        and(
          eq(upgradeTask.redeemCodeId, code.id),
          inArray(upgradeTask.status, [
            UpgradeTaskStatus.FAILED,
            UpgradeTaskStatus.CANCELED,
          ])
        )
      )
      .orderBy(desc(upgradeTask.createdAt), desc(upgradeTask.updatedAt))
      .limit(1)
      .for('update');

    if (reusableTask) {
      const metadata = parseUpgradeTaskMetadata(reusableTask.metadata);
      if (metadata.manualRequired) {
        throw new Error('该任务需人工处理，不能直接重试');
      }

      await tx
        .update(redeemCode)
        .set({
          status: RedeemCodeStatus.CONSUMED,
          usedByTaskId: reusableTask.id,
          usedAt: dbTimestampNow(),
        })
        .where(eq(redeemCode.id, code.id));

      await tx
        .update(upgradeTask)
        .set({
          sessionToken: req.sessionToken,
          chatgptEmail: account.email,
          chatgptAccountId: account.accountId,
          chatgptCurrentPlan: account.currentPlan,
          status: UpgradeTaskStatus.PENDING,
          attemptCount: 0,
          lastError: null,
          resultMessage: null,
          startedAt: null,
          finishedAt: null,
          successChannelId: null,
          successChannelCardkeyId: null,
          clientIp: req.clientIp,
          userAgent: req.userAgent,
          metadata: req.metadata ? JSON.stringify(req.metadata) : null,
        })
        .where(eq(upgradeTask.id, reusableTask.id));

      taskNo = reusableTask.taskNo;
      return;
    }

    await tx
      .update(redeemCode)
      .set({
        status: RedeemCodeStatus.CONSUMED,
        usedByTaskId: newTaskId,
        usedAt: dbTimestampNow(),
      })
      .where(eq(redeemCode.id, code.id));

    await tx.insert(upgradeTask).values({
      id: newTaskId,
      taskNo: newTaskNo,
      redeemCodeId: code.id,
      redeemCodePlain: normalizedCode,
      productCode: code.productCode,
      memberType: code.memberType,
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
  productCode: string;
  memberType: string;
  chatgptEmail: string;
  chatgptCurrentPlan?: string | null;
  manualRequired: boolean;
  createdAt: Date;
  finishedAt?: Date | null;
}

const PUBLIC_TASK_MESSAGES: Record<string, string> = {
  pending: '升级任务已提交，正在排队处理...',
  running: '正在为您升级，请稍候...',
  succeeded: '升级成功！请刷新您的 ChatGPT 页面查看。',
  failed: '充值异常，请联系客服处理。',
  canceled: '任务已取消。',
};

function toPublicTaskStatus(task: {
  taskNo: string;
  status: string;
  productCode: string;
  memberType: string;
  chatgptEmail: string;
  chatgptCurrentPlan: string | null;
  metadata: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): PublicTaskStatus {
  const metadata = parseUpgradeTaskMetadata(task.metadata);

  return {
    taskNo: task.taskNo,
    status: task.status,
    message: PUBLIC_TASK_MESSAGES[task.status] || '未知状态',
    productCode: task.productCode,
    memberType: task.memberType,
    chatgptEmail: task.chatgptEmail,
    chatgptCurrentPlan: task.chatgptCurrentPlan,
    manualRequired: Boolean(metadata.manualRequired),
    createdAt: task.createdAt,
    finishedAt: task.finishedAt,
  };
}

function getConsumedRedeemCodeReason(task: PublicTaskStatus | null): string {
  if (!task) return 'already_used';
  if (task.status === UpgradeTaskStatus.SUCCEEDED) return 'already_succeeded';
  if (
    task.status === UpgradeTaskStatus.PENDING ||
    task.status === UpgradeTaskStatus.RUNNING
  ) {
    return 'processing';
  }
  if (task.status === UpgradeTaskStatus.FAILED && task.manualRequired) {
    return 'manual_required';
  }
  return 'occupied';
}

async function getPublicTaskStatusForRedeemCode(
  redeemCodeId: string,
  usedByTaskId?: string | null
): Promise<PublicTaskStatus | null> {
  const conditions = usedByTaskId
    ? eq(upgradeTask.id, usedByTaskId)
    : eq(upgradeTask.redeemCodeId, redeemCodeId);

  const [task] = await db()
    .select({
      taskNo: upgradeTask.taskNo,
      status: upgradeTask.status,
      productCode: upgradeTask.productCode,
      memberType: upgradeTask.memberType,
      chatgptEmail: upgradeTask.chatgptEmail,
      chatgptCurrentPlan: upgradeTask.chatgptCurrentPlan,
      metadata: upgradeTask.metadata,
      createdAt: upgradeTask.createdAt,
      finishedAt: upgradeTask.finishedAt,
    })
    .from(upgradeTask)
    .where(conditions)
    .orderBy(desc(upgradeTask.createdAt))
    .limit(1);

  return task ? toPublicTaskStatus(task) : null;
}

export async function queryTaskStatus(
  taskNo: string
): Promise<PublicTaskStatus | null> {
  const [task] = await db()
    .select({
      taskNo: upgradeTask.taskNo,
      status: upgradeTask.status,
      productCode: upgradeTask.productCode,
      memberType: upgradeTask.memberType,
      chatgptEmail: upgradeTask.chatgptEmail,
      chatgptCurrentPlan: upgradeTask.chatgptCurrentPlan,
      metadata: upgradeTask.metadata,
      createdAt: upgradeTask.createdAt,
      finishedAt: upgradeTask.finishedAt,
    })
    .from(upgradeTask)
    .where(eq(upgradeTask.taskNo, taskNo));

  if (!task) return null;

  return toPublicTaskStatus(task);
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
          startedAt: dbTimestampNow(),
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
            finishedAt: dbTimestampNow(),
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
            finishedAt: dbTimestampNow(),
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
          finishedAt: dbTimestampNow(),
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
    const search = args.search.trim();
    conditions.push(
      sql`(${upgradeTask.redeemCodePlain} = ${search} OR ${upgradeTask.chatgptEmail} = ${search} OR ${upgradeTask.taskNo} = ${search})`
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
  const trimmedChannelCardkey = input?.channelCardkey?.trim();
  if (trimmedChannelCardkey && !input?.channelId) {
    throw new Error('填写渠道卡密时必须选择渠道');
  }

  let channelName: string | undefined;
  if (input?.channelId) {
    const channel = await getChannelById(input.channelId);
    if (!channel) {
      throw new Error('渠道不存在');
    }
    channelName = channel.name;
  }

  await db().transaction(async (tx: any) => {
    const [task] = await tx
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, taskId))
      .limit(1)
      .for('update');

    if (!task) throw new Error('Task not found');
    if (task.status === UpgradeTaskStatus.SUCCEEDED) {
      throw new Error('任务已经是成功状态');
    }

    let successChannelCardkeyId = task.successChannelCardkeyId;
    if (trimmedChannelCardkey && input?.channelId) {
      const [cardkey] = await tx
        .select()
        .from(channelCardkey)
        .where(
          and(
            eq(channelCardkey.channelId, input.channelId),
            eq(channelCardkey.cardkey, trimmedChannelCardkey)
          )
        )
        .limit(1)
        .for('update');

      if (!cardkey) {
        throw new Error('渠道库存中未找到该卡密');
      }

      successChannelCardkeyId = cardkey.id;
      await tx
        .update(channelCardkey)
        .set({
          status: 'used',
          lockedByTaskId: null,
          usedByAttemptId: null,
          usedAt: dbTimestampNow(),
        })
        .where(eq(channelCardkey.id, cardkey.id));
    }

    await tx
      .update(upgradeTask)
      .set({
        status: UpgradeTaskStatus.SUCCEEDED,
        finishedAt: dbTimestampNow(),
        lastError: null,
        successChannelId: input?.channelId || task.successChannelId,
        successChannelCardkeyId,
        resultMessage: '管理员已标记成功',
        metadata: mergeUpgradeTaskMetadata(task.metadata, {
          adminNote: input?.note,
          manualSuccessChannelId: input?.channelId,
          manualSuccessChannelName: channelName,
          manualSuccessChannelCardkey: trimmedChannelCardkey,
        }),
      })
      .where(eq(upgradeTask.id, taskId));

    await tx
      .update(redeemCode)
      .set({ status: 'consumed' })
      .where(eq(redeemCode.id, task.redeemCodeId));
  });
}

export async function rebindTaskChannelCardkey(
  taskId: string,
  input: {
    channelId: string;
    channelCardkey: string;
    note?: string;
  }
) {
  const channelId = input.channelId?.trim();
  const trimmedChannelCardkey = input.channelCardkey?.trim();

  if (!channelId) {
    throw new Error('请选择渠道');
  }
  if (!trimmedChannelCardkey) {
    throw new Error('请输入渠道卡密');
  }

  const channel = await getChannelById(channelId);
  if (!channel) {
    throw new Error('渠道不存在');
  }

  await db().transaction(async (tx: any) => {
    const [task] = await tx
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, taskId))
      .limit(1)
      .for('update');

    if (!task) throw new Error('Task not found');
    if (task.status !== UpgradeTaskStatus.SUCCEEDED) {
      throw new Error('仅成功任务可以更换渠道卡密');
    }

    const [nextCardkey] = await tx
      .select()
      .from(channelCardkey)
      .where(
        and(
          eq(channelCardkey.channelId, channelId),
          eq(channelCardkey.cardkey, trimmedChannelCardkey)
        )
      )
      .limit(1)
      .for('update');

    if (!nextCardkey) {
      throw new Error('渠道库存中未找到该卡密');
    }
    if (nextCardkey.lockedByTaskId && nextCardkey.lockedByTaskId !== task.id) {
      throw new Error('该渠道卡密正被其他任务锁定');
    }

    const previousCardkeyId = task.successChannelCardkeyId;
    const [{ total: targetOtherTaskCount }] = await tx
      .select({ total: count() })
      .from(upgradeTask)
      .where(
        and(
          eq(upgradeTask.successChannelCardkeyId, nextCardkey.id),
          sql`${upgradeTask.id} <> ${task.id}`
        )
      );

    if (targetOtherTaskCount > 0) {
      throw new Error('该渠道卡密已绑定其他成功任务');
    }

    if (previousCardkeyId && previousCardkeyId !== nextCardkey.id) {
      const [previousCardkey] = await tx
        .select()
        .from(channelCardkey)
        .where(eq(channelCardkey.id, previousCardkeyId))
        .limit(1)
        .for('update');

      const [{ total: otherTaskCount }] = await tx
        .select({ total: count() })
        .from(upgradeTask)
        .where(
          and(
            eq(upgradeTask.successChannelCardkeyId, previousCardkeyId),
            sql`${upgradeTask.id} <> ${task.id}`
          )
        );

      if (
        previousCardkey &&
        otherTaskCount === 0 &&
        previousCardkey.status === ChannelInventoryStatus.USED &&
        !previousCardkey.usedByAttemptId
      ) {
        await tx
          .update(channelCardkey)
          .set({
            status: ChannelInventoryStatus.AVAILABLE,
            lockedByTaskId: null,
            usedByAttemptId: null,
            usedAt: null,
          })
          .where(eq(channelCardkey.id, previousCardkey.id));
      }
    }

    const nextCardkeyUpdate: Record<string, unknown> = {
      status: ChannelInventoryStatus.USED,
      lockedByTaskId: null,
    };
    if (!nextCardkey.usedAt) {
      nextCardkeyUpdate.usedAt = dbTimestampNow();
    }

    await tx
      .update(channelCardkey)
      .set(nextCardkeyUpdate)
      .where(eq(channelCardkey.id, nextCardkey.id));

    await tx
      .update(upgradeTask)
      .set({
        successChannelId: channelId,
        successChannelCardkeyId: nextCardkey.id,
        resultMessage: '管理员已更正渠道卡密绑定',
        metadata: mergeUpgradeTaskMetadata(task.metadata, {
          adminNote: input.note,
          manualSuccessChannelId: channelId,
          manualSuccessChannelName: channel.name,
          manualSuccessChannelCardkey: trimmedChannelCardkey,
        }),
      })
      .where(eq(upgradeTask.id, taskId));
  });
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
        usedAt: dbTimestampNow(),
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
    const metadata = parseUpgradeTaskMetadata(task.metadata);
    if (metadata.manualRequired) {
      throw new Error('该任务需人工处理，不能取消');
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
        finishedAt: dbTimestampNow(),
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
