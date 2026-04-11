import type { UpgradeChannelAdapter, UpgradeRequest, UpgradeResult } from '../types';
import { registerAdapter } from '../registry';

const BASE_URL = 'https://987ai.vip';
const TIMEOUT_MS = 60_000; // 单次请求超时
const POLL_INTERVAL_MS = 3_000; // 轮询间隔
const MAX_POLL_COUNT = 200; // 最大轮询次数

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const adapter987ai: UpgradeChannelAdapter = {
  async execute(req: UpgradeRequest): Promise<UpgradeResult> {
    const { channelCardkey, sessionToken } = req;

    if (!channelCardkey) {
      return { ok: false, retryable: false, message: '缺少渠道卡密' };
    }

    // Step 1: 验证渠道卡密
    try {
      const verifyRes = await fetchWithTimeout(
        `${BASE_URL}/api/card-keys/${encodeURIComponent(channelCardkey)}`,
        { method: 'GET' },
        TIMEOUT_MS
      );
      const verifyData = await verifyRes.json();

      if (!verifyData.available) {
        return {
          ok: false,
          retryable: false,
          message: `渠道卡密不可用: ${verifyData.error || '未知原因'}`,
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        retryable: true,
        message: `验证渠道卡密失败: ${err.message}`,
      };
    }

    // Step 2: 创建升级任务
    let taskId: string;
    try {
      const createRes = await fetchWithTimeout(
        `${BASE_URL}/api/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_key: channelCardkey,
            access_token: sessionToken,
          }),
        },
        TIMEOUT_MS
      );
      const createData = await createRes.json();

      if (!createData.success) {
        return {
          ok: false,
          retryable: false,
          message: `创建升级任务失败: ${createData.error || '未知错误'}`,
        };
      }

      taskId = createData.task_id;
    } catch (err: any) {
      return {
        ok: false,
        retryable: true,
        message: `创建升级任务网络错误: ${err.message}`,
      };
    }

    // Step 3: 轮询任务结果
    for (let i = 0; i < MAX_POLL_COUNT; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      try {
        const pollRes = await fetchWithTimeout(
          `${BASE_URL}/api/tasks/${encodeURIComponent(taskId)}`,
          { method: 'GET' },
          TIMEOUT_MS
        );
        const pollData = await pollRes.json();

        if (pollData.status === 'completed') {
          return {
            ok: true,
            message: pollData.result || '升级成功',
          };
        }

        if (pollData.status === 'failed') {
          return {
            ok: false,
            retryable: false,
            message: `升级失败: ${pollData.error || '未知错误'}`,
          };
        }

        if (pollData.status === 'unknown') {
          return {
            ok: false,
            retryable: false,
            message: `任务不存在: ${pollData.error || ''}`,
          };
        }

        // pending / processing -> 继续轮询
      } catch (err: any) {
        // 网络抖动，继续轮询（不立即失败）
        console.warn(`[987ai] poll error (attempt ${i + 1}): ${err.message}`);
      }
    }

    // 超过最大轮询次数
    return {
      ok: false,
      retryable: true,
      message: `升级超时：已轮询 ${MAX_POLL_COUNT} 次，任务仍未完成`,
    };
  },
};

registerAdapter('987ai', adapter987ai);

export default adapter987ai;
