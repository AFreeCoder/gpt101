import { and, count, desc, eq, lte, isNull, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { upgradeTask } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { consumeCode, markCodeConsumed, rollbackCode } from '@/shared/models/redeem-code';
import { runTask } from '@/extensions/upgrade-channel/runner';

export type UpgradeTask = typeof upgradeTask.$inferSelect;

export enum UpgradeTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
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
  if (row.status === 'consumed') return { valid: false, reason: 'already_used' };

  return { valid: true, productCode: row.productCode, memberType: row.memberType };
}

// --- Step 2: 解析 session token ---

export async function resolveAccount(sessionToken: string): Promise<{
  email: string;
  accountId: string;
  currentPlan?: string;
  accessToken?: string;
}> {
  // 用户可能提交纯 accessToken 字符串，也可能提交完整的 JSON
  let parsed: any = null;

  try {
    parsed = JSON.parse(sessionToken);
  } catch {
    // 不是 JSON，当作纯 accessToken 处理
  }

  if (parsed && typeof parsed === 'object') {
    // JSON 格式：从中提取信息
    const email = parsed.user?.email || '';
    const accountId = parsed.account?.id || parsed.user?.id || '';
    const currentPlan = parsed.account?.planType || '';
    const accessToken = parsed.accessToken || '';

    if (!email) {
      throw new Error('无法从 Token 中解析出邮箱，请检查 Token 格式');
    }

    return { email, accountId, currentPlan, accessToken };
  }

  // 纯 accessToken 字符串：尝试解码 JWT payload 提取邮箱
  try {
    const parts = sessionToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const profile = payload['https://api.openai.com/profile'] || {};
      const auth = payload['https://api.openai.com/auth'] || {};
      return {
        email: profile.email || '',
        accountId: auth.chatgpt_user_id || payload.sub || '',
        currentPlan: auth.chatgpt_plan_type || '',
        accessToken: sessionToken,
      };
    }
  } catch {}

  throw new Error('无法解析 Token，请粘贴完整的 Session Token 内容');
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

  await db().transaction(async (tx: any) => {
    // 锁定卡密
    const result = await consumeCode(tx, req.code, taskId);
    if (!result.ok) {
      throw new Error(`Redeem code error: ${result.reason}`);
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
      chatgptEmail: req.chatgptEmail,
      chatgptAccountId: req.chatgptAccountId,
      chatgptCurrentPlan: req.chatgptCurrentPlan,
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
    failed: '升级失败，请联系客服处理。',
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
    // 拉取一个 pending 任务
    const [task] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.status, UpgradeTaskStatus.PENDING))
      .orderBy(upgradeTask.createdAt)
      .limit(1);

    if (!task) break;

    // 标记为 running
    await db()
      .update(upgradeTask)
      .set({
        status: UpgradeTaskStatus.RUNNING,
        startedAt: new Date(),
      })
      .where(
        and(
          eq(upgradeTask.id, task.id),
          eq(upgradeTask.status, UpgradeTaskStatus.PENDING)
        )
      );

    // 执行升级
    try {
      const result = await runTask({
        taskId: task.id,
        productCode: task.productCode as 'plus' | 'pro' | 'team',
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
            finishedAt: new Date(),
          })
          .where(eq(upgradeTask.id, task.id));

        // 标记本站卡密为已消费
        await markCodeConsumed(task.redeemCodeId);
      } else {
        await db()
          .update(upgradeTask)
          .set({
            status: UpgradeTaskStatus.FAILED,
            lastError: result.error,
            attemptCount: result.attempts.length,
            finishedAt: new Date(),
          })
          .where(eq(upgradeTask.id, task.id));

        // 失败：回滚本站卡密
        await rollbackCode(task.redeemCodeId);
      }
    } catch (err: any) {
      await db()
        .update(upgradeTask)
        .set({
          status: UpgradeTaskStatus.FAILED,
          lastError: err.message,
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
  note?: string
) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Task not found');

  await db()
    .update(upgradeTask)
    .set({
      status: UpgradeTaskStatus.SUCCEEDED,
      finishedAt: new Date(),
      metadata: note
        ? JSON.stringify({ ...JSON.parse(task.metadata || '{}'), adminNote: note })
        : task.metadata,
    })
    .where(eq(upgradeTask.id, taskId));

  await markCodeConsumed(task.redeemCodeId);
}

export async function retryTask(taskId: string) {
  await db()
    .update(upgradeTask)
    .set({
      status: UpgradeTaskStatus.PENDING,
      lastError: null,
      startedAt: null,
      finishedAt: null,
    })
    .where(
      and(
        eq(upgradeTask.id, taskId),
        sql`${upgradeTask.status} IN ('failed', 'canceled')`
      )
    );
}

export async function cancelTask(taskId: string, reason?: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Task not found');

  await db()
    .update(upgradeTask)
    .set({
      status: UpgradeTaskStatus.CANCELED,
      lastError: reason || 'Canceled by admin',
      finishedAt: new Date(),
    })
    .where(eq(upgradeTask.id, taskId));

  // 回滚卡密
  if (task.status !== UpgradeTaskStatus.SUCCEEDED) {
    await rollbackCode(task.redeemCodeId);
  }
}
