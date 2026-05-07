import { registerAdapter } from '../registry';
import type {
  UpgradeChannelAdapter,
  UpgradeRequest,
  UpgradeResult,
} from '../types';

const BASE_URL = 'https://ht.gptai.vip/api';
const REQUEST_TIMEOUT_MS = 30_000;
const REDEEM_CONFIRMATION_WINDOW_MS = 10 * 60 * 1000;
const DNSCON_TIMEZONE_OFFSET_HOURS = 8;

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
    payload?.data?.message ||
    payload?.data?.msg ||
    payload?.data?.error ||
    payload?.msg ||
    payload?.message ||
    payload?.error;

  return typeof message === 'string' && message.trim()
    ? message.trim()
    : '未知错误';
}

function buildFailureMessage(message: string): string {
  return `dnscon 渠道充值异常：${message}`;
}

function parseSessionData(sessionToken: string): Record<string, any> {
  try {
    const parsed = JSON.parse(sessionToken);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    // fall through
  }

  throw new Error('Session Data 格式错误，请确保复制了完整页面内容');
}

function validateSessionData(sessionData: Record<string, any>) {
  const email = String(sessionData?.user?.email || '').trim();
  const accountId = String(sessionData?.account?.id || '').trim();
  const planType = String(sessionData?.account?.planType || '').trim();
  const structure = String(sessionData?.account?.structure || '').trim();

  if (!email || !accountId || !planType) {
    throw new Error('Session Data 格式错误，请确保复制了完整页面内容');
  }

  if (structure !== 'personal') {
    throw new Error('请使用个人版 Token');
  }
}

function isVerifyValid(payload: any): boolean {
  return payload?.data?.exists === true && payload?.data?.valid === true;
}

function isSubmitSuccess(payload: any): boolean {
  const officialMessage =
    typeof payload?.msg === 'string' && payload.msg.trim()
      ? payload.msg.trim()
      : typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : '';

  return payload?.success === true || officialMessage.includes('成功');
}

function isKnownCardkeyFailure(message: string): boolean {
  return (
    message.includes('卡密不存在') ||
    message.includes('卡密信息不存在') ||
    message.includes('未启用') ||
    message.includes('已禁用') ||
    message.includes('卡密无效') ||
    message.includes('已使用')
  );
}

function isRedeemedVerifyResult(payload: any): boolean {
  const data = payload?.data || {};
  return (
    data?.cardStatus === '1' ||
    String(data?.message || '').includes('已兑换') ||
    extractMessage(payload).includes('已兑换')
  );
}

function normalizeEmail(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseDnsconRedeemTime(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - DNSCON_TIMEZONE_OFFSET_HOURS,
      Number(minute),
      Number(second)
    );
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function findBatchQueryCard(payload: any, channelCardkey: string): any | null {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const target = String(channelCardkey || '')
    .trim()
    .toLowerCase();
  return (
    rows.find(
      (row: any) =>
        String(row?.cardCode || '')
          .trim()
          .toLowerCase() === target
    ) || null
  );
}

function isConfirmedCurrentRedemption(args: {
  row: any;
  chatgptEmail: string;
  attemptStartedAt: Date;
  checkedAt: Date;
}): boolean {
  if (!args.row || String(args.row.status || '') !== '1') {
    return false;
  }

  if (
    normalizeEmail(args.row.redeemEmail) !== normalizeEmail(args.chatgptEmail)
  ) {
    return false;
  }

  const redeemTime = parseDnsconRedeemTime(args.row.redeemTime);
  if (!redeemTime) {
    return false;
  }

  const start = args.attemptStartedAt.getTime() - REDEEM_CONFIRMATION_WINDOW_MS;
  const end = args.checkedAt.getTime() + REDEEM_CONFIRMATION_WINDOW_MS;
  return redeemTime >= start && redeemTime <= end;
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
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: 'https://www.dnscon.xyz',
        Referer: 'https://www.dnscon.xyz/',
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

export function createDnsconAdapter(
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

  async function verifyCard(channelCardkey: string): Promise<any> {
    return requestJson('/redeem/verify', { cardCode: channelCardkey });
  }

  async function batchQueryCard(channelCardkey: string): Promise<any> {
    return requestJson('/card/batchQuery', { cardCodes: [channelCardkey] });
  }

  async function confirmRedeemedCard(
    channelCardkey: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult | null> {
    try {
      const batchData = await batchQueryCard(channelCardkey);
      const row = findBatchQueryCard(batchData, channelCardkey);

      if (
        isConfirmedCurrentRedemption({
          row,
          chatgptEmail,
          attemptStartedAt,
          checkedAt: now(),
        })
      ) {
        return {
          ok: true,
          message: '批量查卡确认渠道卡密已兑换到当前账号',
        };
      }
    } catch {
      // 无法确认时继续走原有人工处理兜底。
    }

    return null;
  }

  async function classifyUncertainSubmit(
    channelCardkey: string,
    lastMessage: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult> {
    try {
      const verifyData = await verifyCard(channelCardkey);

      if (isVerifyValid(verifyData)) {
        return {
          ok: false,
          retryable: true,
          cardkeyAction: 'release',
          message: buildFailureMessage(
            `充值结果无法确认，二次验卡仍有效，释放渠道卡密：${lastMessage}`
          ),
        };
      }

      if (isRedeemedVerifyResult(verifyData)) {
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
        message: buildFailureMessage(
          `充值结果无法确认，二次验卡无效，需人工处理：${extractMessage(verifyData)}`
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

      try {
        validateSessionData(parseSessionData(sessionToken));
      } catch (error: any) {
        return {
          ok: false,
          retryable: false,
          message: buildFailureMessage(error?.message || 'Session Data 无效'),
        };
      }

      let verifyData: any;
      try {
        verifyData = await verifyCard(channelCardkey);
      } catch (error: any) {
        return {
          ok: false,
          retryable: true,
          message: buildFailureMessage(
            `redeem/verify 请求失败：${error?.message || '网络异常'}`
          ),
        };
      }

      if (!isVerifyValid(verifyData)) {
        return {
          ok: false,
          retryable: false,
          cardkeyAction: 'disable',
          message: buildFailureMessage(
            `redeem/verify 失败：${extractMessage(verifyData)}`
          ),
        };
      }

      try {
        const submitData = await requestJson('/redeem/submit', {
          cardCode: channelCardkey,
          tokenContent: sessionToken,
        });

        if (isSubmitSuccess(submitData)) {
          return {
            ok: true,
            message: extractMessage(submitData),
          };
        }

        const message = extractMessage(submitData);
        if (isKnownCardkeyFailure(message)) {
          return {
            ok: false,
            retryable: false,
            cardkeyAction: 'disable',
            message: buildFailureMessage(`redeem/submit 失败：${message}`),
          };
        }

        return classifyUncertainSubmit(
          channelCardkey,
          message,
          req.chatgptEmail,
          attemptStartedAt
        );
      } catch (error: any) {
        return classifyUncertainSubmit(
          channelCardkey,
          error?.message || 'redeem/submit 请求失败',
          req.chatgptEmail,
          attemptStartedAt
        );
      }
    },
  };
}

const adapterDnscon = createDnsconAdapter();

registerAdapter('dnscon.xyz', adapterDnscon);

export default adapterDnscon;
