import {
  findCardRecord,
  isConfirmedCurrentRedemption,
  pickFirstPresentField,
} from '../redeemed-card-confirmation';
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
  now?: () => Date;
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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `request failed with status: ${res.status}`
      );
    }
    return data;
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
  const now = options.now || (() => new Date());

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

  async function verifyCard(channelCardkey: string): Promise<any> {
    return requestJSON(`/card-keys/${encodeURIComponent(channelCardkey)}`);
  }

  async function batchQueryCard(channelCardkey: string): Promise<any> {
    return requestJSON('/card-keys/batch-query', {
      method: 'POST',
      body: JSON.stringify({ card_keys: [channelCardkey] }),
    });
  }

  function isVerifyAvailable(payload: any): boolean {
    const status = String(payload?.status || payload?.data?.status || '')
      .trim()
      .toLowerCase();
    return payload?.available === true || status === 'normal' || status === '0';
  }

  function isVerifyUsed(payload: any): boolean {
    const status = String(payload?.status || payload?.data?.status || '')
      .trim()
      .toLowerCase();
    const message = String(payload?.error || payload?.message || '');
    return (
      payload?.available === false ||
      status === 'used' ||
      status === '1' ||
      message.includes('已使用') ||
      message.includes('已兑换')
    );
  }

  function isBatchQueryRowUsed(row: any): boolean {
    const status = pickFirstPresentField(row, ['status', 'cardStatus']);
    return (
      Number(status) === 1 ||
      String(status || '')
        .trim()
        .toLowerCase() === 'used'
    );
  }

  function isConfirmed987aiRedemption(args: {
    row: any;
    chatgptEmail: string;
    attemptStartedAt: Date;
  }): boolean {
    return isConfirmedCurrentRedemption({
      isRedeemed: isBatchQueryRowUsed(args.row),
      redeemEmail: pickFirstPresentField(args.row, [
        'user_id',
        'userId',
        'email',
        'userEmail',
        'redeemEmail',
      ]),
      redeemTime: pickFirstPresentField(args.row, [
        'used_at',
        'usedAt',
        'updated_at',
        'updatedAt',
        'redeemTime',
        'timestamp',
      ]),
      chatgptEmail: args.chatgptEmail,
      attemptStartedAt: args.attemptStartedAt,
      checkedAt: now(),
    });
  }

  async function confirmRedeemedCard(
    channelCardkey: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult | null> {
    try {
      const batchData = await batchQueryCard(channelCardkey);
      const row = findCardRecord(batchData, channelCardkey);

      if (
        isConfirmed987aiRedemption({
          row,
          chatgptEmail,
          attemptStartedAt,
        })
      ) {
        return {
          ok: true,
          message: '批量查卡确认渠道卡密已兑换到当前账号',
        };
      }
    } catch {
      // 无法确认时继续走人工处理兜底。
    }

    return null;
  }

  async function classifyUncertainTask(
    channelCardkey: string,
    lastMessage: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult> {
    try {
      const verifyData = await verifyCard(channelCardkey);

      if (isVerifyAvailable(verifyData)) {
        return {
          ok: false,
          retryable: true,
          cardkeyAction: 'release',
          message: `987ai 充值结果无法确认，二次验卡仍有效，释放渠道卡密：${lastMessage}`,
        };
      }

      if (isVerifyUsed(verifyData)) {
        const confirmed = await confirmRedeemedCard(
          channelCardkey,
          chatgptEmail,
          attemptStartedAt
        );
        if (confirmed) return confirmed;
      }

      return {
        ok: false,
        retryable: false,
        stopFallback: true,
        preserveRedeemCode: true,
        cardkeyAction: 'consume',
        message: `987ai 充值结果无法确认，二次验卡无效，需人工处理：${lastMessage}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        retryable: false,
        stopFallback: true,
        preserveRedeemCode: true,
        cardkeyAction: 'consume',
        message: `987ai 充值结果无法确认，二次验卡失败，需人工处理：${error?.message || lastMessage}`,
      };
    }
  }

  return {
    async execute(req: UpgradeRequest): Promise<UpgradeResult> {
      const { channelCardkey, sessionToken } = req;
      const attemptStartedAt = now();

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
        const verifyData = await verifyCard(channelCardkey);

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
          return classifyUncertainTask(
            channelCardkey,
            `创建升级任务失败: ${createData.error || '未知错误'}`,
            req.chatgptEmail,
            attemptStartedAt
          );
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
        return classifyUncertainTask(
          channelCardkey,
          `创建升级任务网络错误: ${err.message}`,
          req.chatgptEmail,
          attemptStartedAt
        );
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

          const taskStatus = String(pollData.status || '')
            .trim()
            .toLowerCase();
          if (!taskStatus) {
            throw new Error(
              `任务状态响应缺少 status: ${
                pollData.error ||
                pollData.message ||
                JSON.stringify(pollData).slice(0, 200)
              }`
            );
          }

          switch (taskStatus) {
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
            return classifyUncertainTask(
              channelCardkey,
              `任务状态连续查询失败 ${maxConsecutivePollErrors} 次：${err.message}`,
              req.chatgptEmail,
              attemptStartedAt
            );
          }
        }
      }
    },
  };
}

const adapter987ai = create987aiAdapter();

registerAdapter('987ai', adapter987ai);

export default adapter987ai;
