import { asc, eq, and } from 'drizzle-orm';

import { db } from '@/core/db';
import { upgradeChannel, upgradeTaskAttempt } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { getAdapter } from './registry';
import type { UpgradeRequest, UpgradeResult } from './types';
import {
  acquireCardkey,
  releaseCardkey,
  markCardkeyUsed,
  disableCardkey,
} from '@/shared/models/channel-cardkey';

// 确保所有 adapter 被注册（side-effect import）
import './adapters/mock';
import './adapters/987ai';

export interface RunTaskInput {
  taskId: string;
  productCode: 'plus' | 'pro' | 'team';
  sessionToken: string;
  chatgptEmail: string;
}

export interface RunTaskResult {
  success: boolean;
  channelId?: string;
  channelCardkeyId?: string;
  error?: string;
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

  const attempts: AttemptRecord[] = [];
  let attemptNo = 0;

  for (const channel of channels) {
    // 检查渠道是否支持该产品
    const supported = channel.supportedProducts
      .split(',')
      .map((s: string) => s.trim());
    if (!supported.includes(input.productCode)) continue;

    // 获取 adapter
    const adapter = getAdapter(channel.driver);
    if (!adapter) {
      console.warn(`[runner] No adapter for driver: ${channel.driver}`);
      continue;
    }

    attemptNo++;
    let cardkey: any = null;
    let cardkeyId: string | undefined;

    // 如果渠道需要卡密，先从库存池获取
    if (channel.requiresCardkey) {
      cardkey = await db().transaction(async (tx: any) => {
        return acquireCardkey(tx, channel.id, input.productCode, input.taskId);
      });

      if (!cardkey) {
        // 库存不足，跳过该渠道
        console.warn(
          `[runner] No cardkeys available for channel ${channel.code}`
        );
        continue;
      }
      cardkeyId = cardkey.id;
    }

    // 构建请求（sessionToken 传完整内容，由 adapter 自行提取需要的部分）
    const req: UpgradeRequest = {
      taskId: input.taskId,
      productCode: input.productCode,
      sessionToken: input.sessionToken,
      chatgptEmail: input.chatgptEmail,
      channelCardkey: cardkey?.cardkey,
    };

    // 执行升级
    const startTime = Date.now();
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
    const attemptId = getUuid();

    // 记录 attempt
    await db().insert(upgradeTaskAttempt).values({
      id: attemptId,
      taskId: input.taskId,
      channelId: channel.id,
      channelCardkeyId: cardkeyId,
      attemptNo,
      status: result.ok ? 'success' : 'failed',
      errorMessage: result.ok ? undefined : result.message,
      durationMs,
      startedAt: new Date(startTime),
      finishedAt: new Date(),
    });

    attempts.push({
      channelId: channel.id,
      channelCardkeyId: cardkeyId,
      attemptNo,
      ok: result.ok,
      message: result.ok ? (result.message || 'success') : result.message,
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
        attempts,
      };
    }

    // 失败：释放渠道卡密
    if (cardkeyId) {
      if (result.message?.includes('invalid_cardkey') || result.message?.includes('卡密无效')) {
        await disableCardkey(cardkeyId, result.message);
      } else {
        await releaseCardkey(cardkeyId);
      }
    }

    // 非 retryable 的失败，继续尝试下一个渠道
    // retryable 的也继续尝试（本轮内穷尽所有渠道）
  }

  return {
    success: false,
    error: `All ${attempts.length} channel attempts failed`,
    attempts,
  };
}
