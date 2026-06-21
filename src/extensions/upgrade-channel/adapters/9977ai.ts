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

const BASE_URL = 'https://9977ai.vip/';
const VERIFY_PATH = 'api-verify-unified.php';
const RECHARGE_PATH = 'simple-submit-recharge-unified.php';
const REUSE_PATH = 'api-recharge-reuse-unified.php';
const REQUEST_TIMEOUT_MS = 30_000;
const REUSE_RETRY_COUNT = 3;

interface AdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  now?: () => Date;
}

class CookieJar {
  private cookies = new Map<string, string>();

  merge(headers: Headers) {
    const setCookies =
      typeof (headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie === 'function'
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : headers.get('set-cookie')
          ? [headers.get('set-cookie') as string]
          : [];

    for (const entry of setCookies) {
      const firstPart = entry.split(';')[0]?.trim();
      if (!firstPart) continue;
      const separatorIndex = firstPart.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      if (!key || !value) continue;
      this.cookies.set(key, value);
    }
  }

  toHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
}

function extractMessage(payload: any): string {
  const message =
    payload?.message || payload?.error || payload?.msg || payload?.detail;

  return typeof message === 'string' && message.trim()
    ? message.trim()
    : '未知错误';
}

async function fetchJsonWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();

    try {
      return {
        response,
        data: text ? JSON.parse(text) : {},
      };
    } catch {
      throw new Error('渠道返回了非 JSON 响应');
    }
  } finally {
    clearTimeout(timer);
  }
}

function buildAdminFailureMessage(message: string): string {
  return `9977 渠道充值异常：${message}`;
}

function normalizeStatus(payload: any): string {
  return String(payload?.status || '')
    .trim()
    .toLowerCase();
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object'
    ? (value as Record<string, any>)
    : {};
}

function getVerifyData(payload: any): Record<string, any> {
  return asRecord(payload?.data);
}

function getExistingRecord(payload: any): Record<string, any> {
  return asRecord(getVerifyData(payload).existing_record);
}

function pickVerifyField(payload: any, fields: string[]) {
  const data = getVerifyData(payload);
  const existingRecord = getExistingRecord(payload);

  return (
    pickFirstPresentField(existingRecord, fields) ||
    pickFirstPresentField(data, fields) ||
    pickFirstPresentField(payload, fields)
  );
}

function isAvailableVerifyResult(payload: any): boolean {
  const status = normalizeStatus(payload);
  const data = getVerifyData(payload);
  return (
    payload?.success === true &&
    (data.allow_new_submission === true ||
      data.has_existing_record === false ||
      payload?.is_new === true ||
      status === 'active' ||
      status === 'available' ||
      status === 'new')
  );
}

function isUsedVerifyResult(payload: any): boolean {
  const message = extractMessage(payload);
  const data = getVerifyData(payload);
  return (
    data.has_existing_record === true ||
    payload?.is_new === false ||
    normalizeStatus(payload) === 'used' ||
    message.includes('已使用') ||
    message.includes('已兑换')
  );
}

export function create9977aiAdapter(
  options: AdapterOptions = {}
): UpgradeChannelAdapter {
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = options.baseUrl || BASE_URL;
  const requestTimeoutMs = options.requestTimeoutMs || REQUEST_TIMEOUT_MS;
  const now = options.now || (() => new Date());

  function endpointUrl(path: string): string {
    return new URL(path, baseUrl).toString();
  }

  async function requestJson(
    jar: CookieJar,
    path: string,
    data: Record<string, unknown>
  ) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const cookieHeader = jar.toHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const { response, data: responseData } = await fetchJsonWithTimeout(
      fetchImpl,
      endpointUrl(path),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      },
      requestTimeoutMs
    );
    jar.merge(response.headers);
    return responseData;
  }

  async function verifyCode(
    jar: CookieJar,
    channelCardkey: string
  ): Promise<any> {
    return requestJson(jar, VERIFY_PATH, {
      activation_code: channelCardkey,
    });
  }

  async function submitRecharge(
    jar: CookieJar,
    sessionToken: string
  ): Promise<any> {
    return requestJson(jar, RECHARGE_PATH, {
      user_data: sessionToken,
    });
  }

  async function reuseRecord(jar: CookieJar): Promise<any> {
    return requestJson(jar, REUSE_PATH, {
      action: 'reuse_record',
    });
  }

  async function reuseRecordWithRetries(
    jar: CookieJar,
    channelCardkey: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult> {
    let lastMessage = '9977 渠道复用记录失败';

    for (let index = 0; index < REUSE_RETRY_COUNT; index++) {
      try {
        const reuseData = await reuseRecord(jar);
        if (reuseData?.success) {
          return {
            ok: true,
            message: reuseData.message || '升级成功',
          };
        }

        lastMessage = extractMessage(reuseData);
      } catch (error: any) {
        lastMessage = error?.message || '复用已有记录时网络异常';
      }
    }

    return classifyFailedRecharge(
      jar,
      channelCardkey,
      chatgptEmail,
      attemptStartedAt,
      lastMessage
    );
  }

  function buildReuseFailureWithVerificationMessage(
    verificationMessage: string,
    lastMessage: string
  ): string {
    return buildAdminFailureMessage(
      `充值提交失败后自动复用 3 次仍未成功，${verificationMessage}：${lastMessage}`
    );
  }

  function confirmUsedCodeFromVerifyData(
    verifyData: any,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): UpgradeResult | null {
    if (
      isConfirmedCurrentRedemption({
        isRedeemed: isUsedVerifyResult(verifyData),
        redeemEmail: pickVerifyField(verifyData, [
          'email',
          'userEmail',
          'redeemEmail',
          'user_id',
          'bound_email',
          'boundEmail',
        ]),
        redeemTime: pickVerifyField(verifyData, [
          'updated_at',
          'updatedAt',
          'used_at',
          'usedAt',
          'redeemTime',
          'timestamp',
          'time',
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

    return null;
  }

  async function classifyFailedRecharge(
    jar: CookieJar,
    channelCardkey: string,
    chatgptEmail: string,
    attemptStartedAt: Date,
    lastMessage: string
  ): Promise<UpgradeResult> {
    try {
      const verifyData = await verifyCode(jar, channelCardkey);

      if (isAvailableVerifyResult(verifyData)) {
        return {
          ok: false,
          retryable: true,
          cardkeyAction: 'release',
          message: buildReuseFailureWithVerificationMessage(
            '二次验卡仍有效，释放渠道卡密',
            lastMessage
          ),
        };
      }

      if (isUsedVerifyResult(verifyData)) {
        const confirmed = confirmUsedCodeFromVerifyData(
          verifyData,
          chatgptEmail,
          attemptStartedAt
        );
        if (confirmed) return confirmed;
      }
    } catch (error: any) {
      return {
        ok: false,
        retryable: false,
        stopFallback: true,
        preserveRedeemCode: true,
        cardkeyAction: 'consume',
        message: buildReuseFailureWithVerificationMessage(
          `二次验卡失败，需人工处理：${error?.message || '网络异常'}`,
          lastMessage
        ),
      };
    }

    return {
      ok: false,
      retryable: false,
      stopFallback: true,
      preserveRedeemCode: true,
      cardkeyAction: 'consume',
      message: buildReuseFailureWithVerificationMessage(
        '二次验卡无法确认当前账号，需人工处理',
        lastMessage
      ),
    };
  }

  async function confirmUsedCode(
    jar: CookieJar,
    channelCardkey: string,
    chatgptEmail: string,
    attemptStartedAt: Date
  ): Promise<UpgradeResult | null> {
    try {
      const verifyData = await verifyCode(jar, channelCardkey);
      return confirmUsedCodeFromVerifyData(
        verifyData,
        chatgptEmail,
        attemptStartedAt
      );
    } catch {
      // 无法确认时继续走原有人工处理兜底。
    }

    return null;
  }

  return {
    async recoverRunningAttempt(
      req: UpgradeRequest & { attemptStartedAt: Date }
    ): Promise<UpgradeResult | null> {
      if (!req.channelCardkey) return null;
      return confirmUsedCode(
        new CookieJar(),
        req.channelCardkey,
        req.chatgptEmail,
        req.attemptStartedAt
      );
    },

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

      const jar = new CookieJar();

      let verifyData: any;
      try {
        verifyData = await verifyCode(jar, channelCardkey);
      } catch (error: any) {
        return {
          ok: false,
          retryable: true,
          message: buildAdminFailureMessage(
            `卡密验证请求失败：${error?.message || '网络异常'}`
          ),
        };
      }

      if (!verifyData?.success) {
        return {
          ok: false,
          retryable: false,
          message: buildAdminFailureMessage(
            `卡密验证失败：${extractMessage(verifyData)}`
          ),
        };
      }

      if (isUsedVerifyResult(verifyData)) {
        return {
          ok: false,
          retryable: false,
          stopFallback: true,
          preserveRedeemCode: true,
          cardkeyAction: 'consume',
          message:
            buildAdminFailureMessage('该卡密已存在历史升级记录，需人工处理'),
        };
      }

      if (!isAvailableVerifyResult(verifyData)) {
        return {
          ok: false,
          retryable: false,
          message: buildAdminFailureMessage(
            `卡密状态不允许新提交：${extractMessage(verifyData)}`
          ),
        };
      }

      try {
        const submitData = await submitRecharge(jar, sessionToken);

        if (submitData?.success) {
          return {
            ok: true,
            message: submitData.message || '升级成功',
          };
        }

        return reuseRecordWithRetries(
          jar,
          channelCardkey,
          req.chatgptEmail,
          attemptStartedAt
        );
      } catch (error: any) {
        return reuseRecordWithRetries(
          jar,
          channelCardkey,
          req.chatgptEmail,
          attemptStartedAt
        );
      }
    },
  };
}

const adapter9977ai = create9977aiAdapter();

registerAdapter('9977ai', adapter9977ai);

export default adapter9977ai;
