import { randomUUID } from 'node:crypto';

import {
  extractAccessTokenAccountSnapshot,
  extractSessionAccountSnapshot,
  normalizePlanType,
  type ResolvedSessionAccount,
} from '@/shared/services/upgrade-task-helpers';

const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const CHATGPT_ACCOUNTS_CHECK_URL =
  'https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27';
const CHATGPT_ACCOUNTS_CHECK_TIMEOUT_MS = 15_000;
const CHATGPT_BROWSER_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Origin: 'https://chatgpt.com',
  Referer: 'https://chatgpt.com/',
  'Sec-Ch-Ua':
    '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
} as const;
const FORBIDDEN_MARKERS = [
  'account has been deactivated',
  'openai account has been deactivated',
  'account deactivated',
  'deactivated due to policy violation',
  'policy violation',
  'terms of service violation',
  'terms-of-service violation',
  'account suspended',
  'has been suspended',
  'suspended for',
  'suspended due to',
  'account banned',
  'has been banned',
] as const;

interface ResolveAccountOptions {
  fetchImpl?: typeof fetch;
  accountCheckUrl?: string;
  accountVerifier?: (
    accessToken: string,
    preferredAccountId?: string
  ) => Promise<RemoteChatGPTAccount>;
  timeoutMs?: number;
}

interface RemoteChatGPTAccount {
  email?: string;
  accountId?: string;
  currentPlan?: string;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object'
    ? (value as Record<string, any>)
    : {};
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function extractRemotePlan(entry: Record<string, any>): string {
  const account = asRecord(entry.account);
  const entitlement = asRecord(entry.entitlement);

  return normalizePlanType(
    readString(account.plan_type, entitlement.subscription_plan)
  );
}

function extractRemoteEmail(
  payload: Record<string, any>,
  entry: Record<string, any>
): string {
  const account = asRecord(entry.account);
  const user = asRecord(payload.user);
  const accountUser = asRecord(entry.account_user);
  const profile = asRecord(entry.profile);

  return readString(
    payload.email,
    user.email,
    entry.email,
    account.email,
    accountUser.email,
    profile.email
  );
}

function selectRemoteAccountEntry(
  accounts: Record<string, any>,
  preferredAccountId?: string
): RemoteChatGPTAccount {
  if (preferredAccountId) {
    const preferred = asRecord(accounts[preferredAccountId]);
    if (Object.keys(preferred).length > 0) {
      return {
        accountId: preferredAccountId,
        currentPlan: extractRemotePlan(preferred),
      };
    }
  }

  let defaultCandidate: RemoteChatGPTAccount | null = null;
  let paidCandidate: RemoteChatGPTAccount | null = null;
  let firstCandidate: RemoteChatGPTAccount | null = null;

  for (const [accountId, rawEntry] of Object.entries(accounts)) {
    const entry = asRecord(rawEntry);
    if (Object.keys(entry).length === 0) {
      continue;
    }

    const account = asRecord(entry.account);
    const candidate: RemoteChatGPTAccount = {
      accountId: readString(account.account_id, accountId),
      currentPlan: extractRemotePlan(entry),
    };

    if (!firstCandidate) {
      firstCandidate = candidate;
    }
    if (account.is_default === true && !defaultCandidate) {
      defaultCandidate = candidate;
    }
    if (
      candidate.currentPlan &&
      candidate.currentPlan !== 'free' &&
      !paidCandidate
    ) {
      paidCandidate = candidate;
    }
  }

  return defaultCandidate || paidCandidate || firstCandidate || {};
}

function buildTemporaryFailureError() {
  return new Error('账号校验服务暂时不可用，请稍后重试');
}

function buildForbiddenAccountError() {
  return new Error('Token 对应账号当前被限制或已停用，请更换可用账号后重试');
}

function buildInvalidAccessTokenError() {
  return new Error(
    'Token 校验失败：access token 无效或已过期，请重新获取 Session Token'
  );
}

function buildMissingAccountError() {
  return new Error(
    'Token 校验失败：未获取到账号信息，请重新获取 Session Token'
  );
}

function createChatGPTHeaders(extra?: Record<string, string>) {
  return {
    ...CHATGPT_BROWSER_HEADERS,
    ...extra,
  };
}

function isTerminalForbidden(message: string) {
  const lowered = message.toLowerCase();
  return FORBIDDEN_MARKERS.some((marker) => lowered.includes(marker));
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers);
  }

  const rawHeader = headers.get('set-cookie');
  if (!rawHeader) {
    return [];
  }

  return rawHeader
    .split(/,(?=[^;]+=[^;]+)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCookieHeader(headers: Headers) {
  return getSetCookieHeaders(headers)
    .map((value) => value.split(';', 1)[0]?.trim() || '')
    .filter(Boolean)
    .join('; ');
}

async function readResponsePayload(response: Response): Promise<{
  payload: Record<string, any> | null;
  rawText: string;
}> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      payload: null,
      rawText,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return {
      payload:
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, any>)
          : null,
      rawText,
    };
  } catch {
    return {
      payload: null,
      rawText,
    };
  }
}

function readErrorMessage(
  payload: Record<string, any> | null,
  rawText: string
) {
  const error = asRecord(payload?.error);
  return readString(error.message, payload?.message, rawText);
}

async function warmChatGPTCookies(
  fetchImpl: typeof fetch,
  signal: AbortSignal
) {
  try {
    const response = await fetchImpl(CHATGPT_HOME_URL, {
      method: 'GET',
      headers: createChatGPTHeaders(),
      signal,
      cache: 'no-store',
    });

    return buildCookieHeader(response.headers);
  } catch {
    return '';
  }
}

async function fetchRemoteChatGPTAccount(
  accessToken: string,
  preferredAccountId: string | undefined,
  options: ResolveAccountOptions = {}
): Promise<RemoteChatGPTAccount> {
  if (options.accountVerifier) {
    return options.accountVerifier(accessToken, preferredAccountId);
  }

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || CHATGPT_ACCOUNTS_CHECK_TIMEOUT_MS
  );

  try {
    const cookieHeader = await warmChatGPTCookies(fetchImpl, controller.signal);
    const response = await fetchImpl(
      options.accountCheckUrl || CHATGPT_ACCOUNTS_CHECK_URL,
      {
        method: 'GET',
        headers: createChatGPTHeaders({
          Authorization: `Bearer ${accessToken}`,
          'oai-device-id': randomUUID(),
          'oai-language': 'en-US',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        }),
        signal: controller.signal,
        cache: 'no-store',
      }
    );

    if (response.status === 401) {
      throw buildInvalidAccessTokenError();
    }

    if (response.status === 403) {
      const { payload, rawText } = await readResponsePayload(response);
      const errorMessage = readErrorMessage(payload, rawText);
      if (isTerminalForbidden(errorMessage)) {
        throw buildForbiddenAccountError();
      }
      throw buildTemporaryFailureError();
    }

    if (!response.ok) {
      throw buildTemporaryFailureError();
    }

    const { payload } = await readResponsePayload(response);
    if (!payload) {
      throw buildTemporaryFailureError();
    }

    const accounts = asRecord(payload.accounts);
    if (Object.keys(accounts).length === 0) {
      throw buildMissingAccountError();
    }

    const selected = selectRemoteAccountEntry(accounts, preferredAccountId);
    const matchedEntry = selected.accountId
      ? asRecord(accounts[selected.accountId])
      : {};

    const accountId = readString(selected.accountId);
    const currentPlan = normalizePlanType(selected.currentPlan);
    const email = extractRemoteEmail(payload, matchedEntry);

    return {
      email,
      accountId,
      currentPlan,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw buildTemporaryFailureError();
    }
    if (error instanceof Error) {
      if (
        error.message.includes('access token 无效或已过期') ||
        error.message.includes('未获取到账号信息') ||
        error.message.includes('账号当前被限制或已停用')
      ) {
        throw error;
      }
    }
    throw buildTemporaryFailureError();
  } finally {
    clearTimeout(timeout);
  }
}

function assertConsistentIdentity(
  current: ResolvedSessionAccount,
  resolved: ResolvedSessionAccount
) {
  if (
    current.email &&
    resolved.email &&
    current.email.toLowerCase() !== resolved.email.toLowerCase()
  ) {
    throw new Error('Token 对应的账号信息不一致，请重新获取最新 Session Token');
  }

  if (
    current.accountId &&
    resolved.accountId &&
    current.accountId !== resolved.accountId
  ) {
    throw new Error('Token 对应的账号信息不一致，请重新获取最新 Session Token');
  }
}

export async function resolveVerifiedSessionAccount(
  sessionToken: string,
  options: ResolveAccountOptions = {}
): Promise<ResolvedSessionAccount> {
  const sessionSnapshot = extractSessionAccountSnapshot(sessionToken);
  const accessTokenSnapshot = extractAccessTokenAccountSnapshot(
    sessionSnapshot.accessToken
  );
  const remoteAccount = await fetchRemoteChatGPTAccount(
    sessionSnapshot.accessToken,
    accessTokenSnapshot.accountId || sessionSnapshot.accountId,
    options
  );

  const resolved: ResolvedSessionAccount = {
    email: readString(
      remoteAccount.email,
      accessTokenSnapshot.email,
      sessionSnapshot.email
    ),
    accountId: readString(
      remoteAccount.accountId,
      accessTokenSnapshot.accountId,
      sessionSnapshot.accountId
    ),
    currentPlan: normalizePlanType(
      readString(
        remoteAccount.currentPlan,
        accessTokenSnapshot.currentPlan,
        sessionSnapshot.currentPlan
      )
    ),
    accessToken: sessionSnapshot.accessToken,
  };

  if (!resolved.email || !resolved.accountId || !resolved.currentPlan) {
    throw new Error(
      '无法从 Token 中解析完整账号信息，请重新获取最新 Session Token'
    );
  }

  assertConsistentIdentity(sessionSnapshot, resolved);

  if (resolved.currentPlan === 'plus') {
    throw new Error('当前为 Plus 会员，请等会员到期后再进行充值升级');
  }

  return resolved;
}
