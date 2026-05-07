import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { upgradeChannel, upgradeTaskAttempt } from '@/config/db/schema';
import { dbTimestampFromDate, dbTimestampNow } from '@/shared/lib/db-time';
import { getUuid } from '@/shared/lib/hash';
import {
  acquireCardkey,
  disableCardkey,
  markCardkeyUsed,
  releaseCardkey,
} from '@/shared/models/channel-cardkey';

import { getAdapter } from './registry';
import type { UpgradeRequest, UpgradeResult } from './types';
// 确保所有 adapter 被注册（side-effect import）
import './adapters/mock';
import './adapters/987ai';
import './adapters/9977ai';
import './adapters/aifadian';
import './adapters/dnscon';

export interface RunTaskInput {
  taskId: string;
  productCode: string;
  memberType: string;
  sessionToken: string;
  chatgptEmail: string;
}

export interface RunTaskResult {
  success: boolean;
  channelId?: string;
  channelCardkeyId?: string;
  message?: string;
  error?: string;
  preserveRedeemCode?: boolean;
  attempts: AttemptRecord[];
}

interface AttemptRecord {
  channelId: string;
  channelCardkeyId?: string;
  attemptNo: number;
  ok: boolean;
  message: string;
  durationMs: number;
}

/**
 * 对一个升级任务，按优先级顺序尝试所有 active 渠道
 */
export async function runTask(input: RunTaskInput): Promise<RunTaskResult> {
  // 获取所有 active 渠道，按优先级排序
  const channels = await db()
    .select()
    .from(upgradeChannel)
    .where(eq(upgradeChannel.status, 'active'))
    .orderBy(asc(upgradeChannel.priority));

  if (channels.length === 0) {
    return {
      success: false,
      error: 'No active channels available',
      attempts: [],
    };
  }

  const [{ maxAttemptNo }] = await db()
    .select({
      maxAttemptNo: sql<number>`coalesce(max(${upgradeTaskAttempt.attemptNo}), 0)`,
    })
    .from(upgradeTaskAttempt)
    .where(eq(upgradeTaskAttempt.taskId, input.taskId));
  const attempts: AttemptRecord[] = [];
  let attemptNo = Number(maxAttemptNo) || 0;

  for (const channel of channels) {
    // 检查渠道是否支持该产品
    const supported = channel.supportedProducts
      .split(',')
      .map((s: string) => s.trim());
    if (!supported.includes(input.productCode)) continue;

    attemptNo++;

    // 获取 adapter
    const adapter = getAdapter(channel.driver);
    if (!adapter) {
      const noAdapterAttemptId = getUuid();
      await db()
        .insert(upgradeTaskAttempt)
        .values({
          id: noAdapterAttemptId,
          taskId: input.taskId,
          channelId: channel.id,
          attemptNo,
          status: 'skipped',
          errorMessage: `未找到渠道适配器: ${channel.driver}`,
          durationMs: 0,
          startedAt: dbTimestampNow(),
          finishedAt: dbTimestampNow(),
        });
      attempts.push({
        channelId: channel.id,
        attemptNo,
        ok: false,
        message: `未找到渠道适配器: ${channel.driver}`,
        durationMs: 0,
      });
      continue;
    }
    let cardkey: any = null;
    let cardkeyId: string | undefined;

    // 如果渠道需要卡密，先从库存池获取
    if (channel.requiresCardkey) {
      cardkey = await db().transaction(async (tx: any) => {
        return acquireCardkey(
          tx,
          channel.id,
          input.productCode,
          input.memberType,
          input.taskId
        );
      });

      if (!cardkey) {
        // 库存不足，记录 attempt 后跳过
        const skipAttemptId = getUuid();
        await db().insert(upgradeTaskAttempt).values({
          id: skipAttemptId,
          taskId: input.taskId,
          channelId: channel.id,
          attemptNo: attemptNo,
          status: 'skipped',
          errorMessage: '渠道卡密库存不足',
          durationMs: 0,
          startedAt: dbTimestampNow(),
          finishedAt: dbTimestampNow(),
        });
        attempts.push({
          channelId: channel.id,
          channelCardkeyId: undefined,
          attemptNo,
          ok: false,
          message: '渠道卡密库存不足',
          durationMs: 0,
        });
        continue;
      }
      cardkeyId = cardkey.id;
    }

    // 构建请求（sessionToken 传完整内容，由 adapter 自行提取需要的部分）
    const req: UpgradeRequest = {
      taskId: input.taskId,
      productCode: input.productCode,
      memberType: input.memberType,
      sessionToken: input.sessionToken,
      chatgptEmail: input.chatgptEmail,
      channelCardkey: cardkey?.cardkey,
    };

    const startTime = Date.now();
    const attemptId = getUuid();

    // 先记录 running attempt，便于后台实时看到当前渠道和已锁定卡密。
    await db()
      .insert(upgradeTaskAttempt)
      .values({
        id: attemptId,
        taskId: input.taskId,
        channelId: channel.id,
        channelCardkeyId: cardkeyId,
        attemptNo,
        status: 'running',
        startedAt: dbTimestampFromDate(new Date(startTime)),
      });

    // 执行升级
    let result: UpgradeResult;

    try {
      result = await adapter.execute(req);
    } catch (err: any) {
      result = {
        ok: false,
        retryable: true,
        message: err.message || 'Adapter threw an exception',
      };
    }

    const durationMs = Date.now() - startTime;

    // 更新已创建的 attempt
    await db()
      .update(upgradeTaskAttempt)
      .set({
        status: result.ok ? 'success' : 'failed',
        errorMessage: result.ok ? null : result.message,
        durationMs,
        finishedAt: dbTimestampNow(),
      })
      .where(eq(upgradeTaskAttempt.id, attemptId));

    attempts.push({
      channelId: channel.id,
      channelCardkeyId: cardkeyId,
      attemptNo,
      ok: result.ok,
      message: result.ok ? result.message || 'success' : result.message,
      durationMs,
    });

    if (result.ok) {
      // 成功：标记渠道卡密为已使用
      if (cardkeyId) {
        await markCardkeyUsed(cardkeyId, attemptId);
      }
      return {
        success: true,
        channelId: channel.id,
        channelCardkeyId: cardkeyId,
        message: result.message || '升级成功',
        attempts,
      };
    }

    const failedResult = result as Extract<UpgradeResult, { ok: false }>;

    if (cardkeyId) {
      switch (failedResult.cardkeyAction || 'release') {
        case 'consume':
          await markCardkeyUsed(cardkeyId, attemptId);
          break;
        case 'disable':
          await disableCardkey(cardkeyId, failedResult.message);
          break;
        default:
          await releaseCardkey(cardkeyId);
      }
    }

    if (failedResult.stopFallback) {
      return {
        success: false,
        error: failedResult.message,
        preserveRedeemCode: failedResult.preserveRedeemCode,
        attempts,
      };
    }
  }

  return {
    success: false,
    error: attempts[attempts.length - 1]?.message || '所有渠道尝试都失败了',
    attempts,
  };
}
