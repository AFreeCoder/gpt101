import type { UpgradeChannelAdapter, UpgradeRequest, UpgradeResult } from '../types';
import { registerAdapter } from '../registry';

// 从前端代码确认的实际 API 配置
const BASE_URL = 'https://api.987ai.vip/api';
const REQUEST_TIMEOUT_MS = 30_000; // 30 秒请求超时
const POLL_INTERVAL_MS = 3_000;    // 3 秒轮询间隔
const MAX_POLL_COUNT = 30;         // 最大轮询 30 次（90 秒）

async function fetchJSON(url: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await res.json();
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

    if (!sessionToken) {
      return { ok: false, retryable: false, message: '缺少 session token' };
    }

    // 从完整 JSON 中提取 accessToken（987ai API 需要纯 accessToken）
    let accessToken = sessionToken;
    try {
      const parsed = JSON.parse(sessionToken);
      if (parsed.accessToken) accessToken = parsed.accessToken;
    } catch {
      // 不是 JSON，当作纯 accessToken
    }

    // Step 1: 验证渠道卡密
    try {
      const verifyData = await fetchJSON(
        `${BASE_URL}/card-keys/${encodeURIComponent(channelCardkey)}`
      );

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
    // 注意：force_recharge 固定为 false（不覆盖充值）
    let taskId: string;
    try {
      const createData = await fetchJSON(`${BASE_URL}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          card_key: channelCardkey,
          access_token: accessToken,
          idp: '',
          force_recharge: false,
        }),
      });

      if (!createData.success) {
        return {
          ok: false,
          retryable: false,
          message: `创建升级任务失败: ${createData.error || '未知错误'}`,
        };
      }

      taskId = createData.task_id || createData.taskId;
      if (!taskId) {
        return { ok: false, retryable: false, message: '创建任务成功但未返回任务 ID' };
      }
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
        const pollData = await fetchJSON(
          `${BASE_URL}/tasks/${encodeURIComponent(taskId)}`
        );

        switch (pollData.status) {
          case 'completed':
            return { ok: true, message: pollData.result || '升级成功' };

          case 'failed':
            return {
              ok: false,
              retryable: false,
              message: `升级失败: ${pollData.error || '未知错误'}`,
            };

          case 'unknown':
            return {
              ok: false,
              retryable: false,
              message: `任务不存在: ${pollData.error || ''}`,
            };

          case 'pending':
          case 'processing':
            // 继续轮询
            break;

          default:
            console.warn(`[987ai] unexpected status: ${pollData.status}`);
            break;
        }
      } catch (err: any) {
        // 网络抖动，继续轮询
        console.warn(`[987ai] poll error (attempt ${i + 1}/${MAX_POLL_COUNT}): ${err.message}`);
      }
    }

    return {
      ok: false,
      retryable: true,
      message: `升级超时：已轮询 ${MAX_POLL_COUNT} 次（${MAX_POLL_COUNT * POLL_INTERVAL_MS / 1000}秒），任务仍未完成`,
    };
  },
};

registerAdapter('987ai', adapter987ai);

export default adapter987ai;
