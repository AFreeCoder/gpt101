import {
  isConfirmedCurrentRedemption,
  pickFirstPresentField,
} from '../redeemed-card-confirmation';
import { registerAdapter } from '../registry';
import type {
  UpgradeChannelAdapter,
  UpgradeRequest,
  UpgradeResult,
} from '../types';

const BASE_URL = 'https://api.afadian.org/api';
const REQUEST_TIMEOUT_MS = 30_000;

interface AdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  now?: () => Date;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function extractMessage(payload: any): string {
  const message =
    payload?.message || payload?.error || payload?.msg || payload?.detail;

  return typeof message === 'string' && message.trim()
    ? message.trim()
    : '未知错误';
}

function buildFailureMessage(message: string): string {
  return `aifadian 渠道充值异常：${message}`;
}

function parseSessionData(sessionToken: string): Record<string, any> {
  try {
    const parsed = JSON.parse(sessionToken);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, any>;
    }
  } catch {
    // fall through
  }

  throw new Error('Session Data 格式错误，请提交完整 Session JSON');
}

function validateSessionData(sessionData: Record<string, any>) {
  const email = String(sessionData?.user?.email || '').trim();
  const accountId = String(sessionData?.account?.id || '').trim();
  const planType = String(sessionData?.account?.planType || '')
    .trim()
    .toLowerCase();

  if (!email || !accountId) {
    throw new Error('无法获取账户信息，请确保 Session Data 正确');
  }

  if (planType !== 'free') {
    throw new Error('账户不是免费用户，无法充值');
  }
}

function normalizeStatus(payload: any): string {
  return String(payload?.status || '')
    .trim()
    .toLowerCase();
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'invalid':
      return '卡密无效';
    case 'used':
      return '卡密已使用';
    case 'forbidden':
      return '卡密已禁止使用';
    default:
      return status ? `卡密状态 ${status}` : '未知卡密状态';
  }
}

function isKnownRechargeCardkeyFailure(message: string): boolean {
  return (
    message.includes('卡密不存在') ||
    message.includes('卡密无效') ||
    message.includes('CDK不存在') ||
    message.includes('CDK无效')
  );
}

function isUsedStatus(status: string): boolean {
  return status === 'used' || status === '1';
}

async function fetchJsonWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error('渠道返回了非 JSON 响应');
    }
  } finally {
    clearTimeout(timer);
  }
}

export function createAifadianAdapter(
  options: AdapterOptions = {}
): UpgradeChannelAdapter {
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl || BASE_URL);
  const requestTimeoutMs = options.requestTimeoutMs || REQUEST_TIMEOUT_MS;
  const now = options.now || (() => new Date());

  async function requestJson(path: string, body: Record<string, any>) {
    return fetchJsonWithTimeout(
      fetchImpl,
      `${baseUrl}${path}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      requestTimeoutMs
    );
  }

  async function verifyCdk(channelCardkey: string): Promise<any> {
    return requestJson('/verify/cdk', { cdk: channelCardkey });
  }

  async function classifyUncertainRecharge(
    channelCardkey: string,
    lastMessage: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult> {
    try {
      const verifyData = await verifyCdk(channelCardkey);
      const status = normalizeStatus(verifyData);

      if (status === 'valid') {
        return {
          ok: false,
          retryable: true,
          cardkeyAction: 'release',
          message: buildFailureMessage(
            `充值结果无法确认，二次验卡仍有效，释放渠道卡密：${lastMessage}`
          ),
        };
      }

      if (
        isUsedStatus(status) &&
        isConfirmedCurrentRedemption({
          isRedeemed: true,
          redeemEmail: pickFirstPresentField(verifyData, [
            'email',
            'userEmail',
            'redeemEmail',
            'user_id',
          ]),
          redeemTime: pickFirstPresentField(verifyData, [
            'updated_at',
            'updatedAt',
            'used_at',
            'usedAt',
            'redeemTime',
            'timestamp',
          ]),
          chatgptEmail,
          attemptStartedAt,
          checkedAt: now(),
        })
      ) {
        return {
          ok: true,
          message: '二次验卡确认渠道卡密已兑换到当前账号',
        };
      }

      return {
        ok: false,
        retryable: false,
        stopFallback: true,
        preserveRedeemCode: true,
        cardkeyAction: 'consume',
        message: buildFailureMessage(
          `充值结果无法确认，二次验卡状态为 ${status || 'unknown'}，需人工处理：${lastMessage}`
        ),
      };
    } catch (error: any) {
      return {
        ok: false,
        retryable: false,
        stopFallback: true,
        preserveRedeemCode: true,
        cardkeyAction: 'consume',
        message: buildFailureMessage(
          `充值结果无法确认，二次验卡失败，需人工处理：${error?.message || lastMessage}`
        ),
      };
    }
  }

  return {
    async execute(req: UpgradeRequest): Promise<UpgradeResult> {
      const { channelCardkey, sessionToken } = req;
      const attemptStartedAt = now();

      if (!channelCardkey) {
        return {
          ok: false,
          retryable: false,
          message: '缺少渠道卡密',
        };
      }

      if (!sessionToken) {
        return {
          ok: false,
          retryable: false,
          message: '缺少 session token',
        };
      }

      let sessionData: Record<string, any>;
      try {
        sessionData = parseSessionData(sessionToken);
        validateSessionData(sessionData);
      } catch (error: any) {
        return {
          ok: false,
          retryable: false,
          message: buildFailureMessage(error?.message || 'Session Data 无效'),
        };
      }

      let verifyData: any;
      try {
        verifyData = await verifyCdk(channelCardkey);
      } catch (error: any) {
        return {
          ok: false,
          retryable: true,
          message: buildFailureMessage(
            `verify/cdk 请求失败：${error?.message || '网络异常'}`
          ),
        };
      }

      const initialStatus = normalizeStatus(verifyData);
      if (initialStatus !== 'valid') {
        return {
          ok: false,
          retryable: false,
          cardkeyAction: 'disable',
          message: buildFailureMessage(
            `verify/cdk 失败：${getStatusMessage(initialStatus)}`
          ),
        };
      }

      try {
        const rechargeData = await requestJson('/recharge', {
          cdk: channelCardkey,
          session_data: sessionData,
        });

        if (rechargeData?.success) {
          return {
            ok: true,
            message: rechargeData.message || '升级成功',
          };
        }

        const message = extractMessage(rechargeData);
        if (isKnownRechargeCardkeyFailure(message)) {
          return {
            ok: false,
            retryable: false,
            cardkeyAction: 'disable',
            message: buildFailureMessage(`recharge 失败：${message}`),
          };
        }

        return classifyUncertainRecharge(
          channelCardkey,
          message,
          req.chatgptEmail,
          attemptStartedAt
        );
      } catch (error: any) {
        return classifyUncertainRecharge(
          channelCardkey,
          error?.message || 'recharge 请求失败',
          req.chatgptEmail,
          attemptStartedAt
        );
      }
    },
  };
}

const adapterAifadian = createAifadianAdapter();

registerAdapter('cdk.aifadian.org', adapterAifadian);
registerAdapter('cdk-aifadian', adapterAifadian);

export default adapterAifadian;
