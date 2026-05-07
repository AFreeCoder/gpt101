import { registerAdapter } from '../registry';
import type {
  UpgradeChannelAdapter,
  UpgradeRequest,
  UpgradeResult,
} from '../types';

const BASE_URL = 'https://9977ai.vip/';
const REQUEST_TIMEOUT_MS = 30_000;
const REUSE_RETRY_COUNT = 3;

interface AdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
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

function isMissingRechargeRecordMessage(message: string): boolean {
  return message.includes('未找到对应的充值记录');
}

export function create9977aiAdapter(
  options: AdapterOptions = {}
): UpgradeChannelAdapter {
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = options.baseUrl || BASE_URL;
  const requestTimeoutMs = options.requestTimeoutMs || REQUEST_TIMEOUT_MS;

  async function requestAction(
    jar: CookieJar,
    action: string,
    data: Record<string, string> = {}
  ) {
    const body = new URLSearchParams();
    body.set('ajax', '1');
    body.set('action', action);
    for (const [key, value] of Object.entries(data)) {
      body.set(key, value);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const cookieHeader = jar.toHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const { response, data: responseData } = await fetchJsonWithTimeout(
      fetchImpl,
      baseUrl,
      {
        method: 'POST',
        headers,
        body,
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
    return requestAction(jar, 'verify_code', {
      activation_code: channelCardkey,
    });
  }

  async function reuseRecordWithRetries(
    jar: CookieJar
  ): Promise<UpgradeResult> {
    let lastMessage = '9977 渠道复用记录失败';

    for (let index = 0; index < REUSE_RETRY_COUNT; index++) {
      try {
        const reuseData = await requestAction(jar, 'reuse_record');
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

    const missingRechargeRecord = isMissingRechargeRecordMessage(lastMessage);

    return {
      ok: false,
      retryable: false,
      stopFallback: true,
      preserveRedeemCode: missingRechargeRecord ? undefined : true,
      cardkeyAction: missingRechargeRecord ? 'release' : 'consume',
      message: buildAdminFailureMessage(
        `submit_json 失败后自动复用 3 次仍未成功：${lastMessage}`
      ),
    };
  }

  return {
    async execute(req: UpgradeRequest): Promise<UpgradeResult> {
      const { channelCardkey, sessionToken } = req;

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
            `verify_code 请求失败：${error?.message || '网络异常'}`
          ),
        };
      }

      if (!verifyData?.success) {
        return {
          ok: false,
          retryable: false,
          message: buildAdminFailureMessage(
            `verify_code 失败：${extractMessage(verifyData)}`
          ),
        };
      }

      if (
        verifyData?.is_new === false ||
        String(verifyData?.status || '')
          .trim()
          .toLowerCase() === 'used'
      ) {
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

      try {
        const submitData = await requestAction(jar, 'submit_json', {
          json_token: sessionToken,
        });

        if (submitData?.success) {
          return {
            ok: true,
            message: submitData.message || '升级成功',
          };
        }

        return reuseRecordWithRetries(jar);
      } catch (error: any) {
        return reuseRecordWithRetries(jar);
      }
    },
  };
}

const adapter9977ai = create9977aiAdapter();

registerAdapter('9977ai', adapter9977ai);

export default adapter9977ai;
