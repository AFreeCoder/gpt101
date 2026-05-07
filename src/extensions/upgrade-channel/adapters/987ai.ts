import { registerAdapter } from '../registry';
import type {
  UpgradeChannelAdapter,
  UpgradeRequest,
  UpgradeResult,
} from '../types';

// 从前端代码确认的实际 API 配置
const BASE_URL = 'https://api.987ai.vip/api';
const REQUEST_TIMEOUT_MS = 30_000; // 30 秒请求超时
const POLL_INTERVAL_MS = 3_000; // 3 秒轮询间隔
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

interface AdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  maxConsecutivePollErrors?: number;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function delay(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(
  fetchImpl: typeof fetch,
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
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

export function create987aiAdapter(
  options: AdapterOptions = {}
): UpgradeChannelAdapter {
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl || BASE_URL);
  const requestTimeoutMs = options.requestTimeoutMs || REQUEST_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxConsecutivePollErrors =
    options.maxConsecutivePollErrors ?? MAX_CONSECUTIVE_POLL_ERRORS;

  async function requestJSON(
    path: string,
    requestOptions: RequestInit = {}
  ): Promise<any> {
    return fetchJSON(
      fetchImpl,
      `${baseUrl}${path}`,
      requestOptions,
      requestTimeoutMs
    );
  }

  return {
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
        const verifyData = await requestJSON(
          `/card-keys/${encodeURIComponent(channelCardkey)}`
        );

        if (!verifyData.available) {
          return {
            ok: false,
            retryable: false,
            cardkeyAction: 'disable',
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

      // Step 2: 验证 Token
      try {
        const tokenData = await requestJSON('/parse-token', {
          method: 'POST',
          body: JSON.stringify({ access_token: accessToken }),
        });

        if (!tokenData.success) {
          return {
            ok: false,
            retryable: false,
            message: `Token 验证失败: ${tokenData.message || '无效的 Token'}`,
          };
        }
      } catch (err: any) {
        return {
          ok: false,
          retryable: true,
          message: `Token 验证网络错误: ${err.message}`,
        };
      }

      // Step 3: 创建升级任务
      // 注意：force_recharge 固定为 false（不覆盖充值）
      let taskId: string;
      try {
        const createData = await requestJSON('/tasks', {
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
          return {
            ok: false,
            retryable: false,
            message: '创建任务成功但未返回任务 ID',
          };
        }
      } catch (err: any) {
        return {
          ok: false,
          retryable: true,
          message: `创建升级任务网络错误: ${err.message}`,
        };
      }

      // Step 4: 轮询任务结果。987ai 前台会一直等到终态，排队中的任务不应按固定次数超时。
      let consecutivePollErrors = 0;
      for (;;) {
        await delay(pollIntervalMs);

        try {
          const pollData = await requestJSON(
            `/tasks/${encodeURIComponent(taskId)}`
          );
          consecutivePollErrors = 0;

          switch (String(pollData.status || '').toLowerCase()) {
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

            default:
              // pending / processing / queued 以及上游新增的非终态都继续等待。
              break;
          }
        } catch (err: any) {
          consecutivePollErrors++;
          console.warn(
            `[987ai] poll error (consecutive ${consecutivePollErrors}/${maxConsecutivePollErrors}): ${err.message}`
          );
          if (consecutivePollErrors >= maxConsecutivePollErrors) {
            return {
              ok: false,
              retryable: false,
              stopFallback: true,
              preserveRedeemCode: true,
              cardkeyAction: 'consume',
              message: `987ai 任务状态连续查询失败 ${maxConsecutivePollErrors} 次，需人工核对：${err.message}`,
            };
          }
        }
      }
    },
  };
}

const adapter987ai = create987aiAdapter();

registerAdapter('987ai', adapter987ai);

export default adapter987ai;
