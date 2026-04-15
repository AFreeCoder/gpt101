import {
  extractAccessTokenAccountSnapshot,
  extractSessionAccountSnapshot,
  normalizePlanType,
  type ResolvedSessionAccount,
} from '@/shared/services/upgrade-task-helpers';

const CHATGPT_ACCOUNTS_CHECK_URL =
  'https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27';
const CHATGPT_ACCOUNTS_CHECK_TIMEOUT_MS = 15_000;

interface ResolveAccountOptions {
  fetchImpl?: typeof fetch;
  accountCheckUrl?: string;
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

async function fetchRemoteChatGPTAccount(
  accessToken: string,
  preferredAccountId: string | undefined,
  options: ResolveAccountOptions = {}
): Promise<RemoteChatGPTAccount> {
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || CHATGPT_ACCOUNTS_CHECK_TIMEOUT_MS
  );

  try {
    const response = await fetchImpl(
      options.accountCheckUrl || CHATGPT_ACCOUNTS_CHECK_URL,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          Origin: 'https://chatgpt.com',
          Referer: 'https://chatgpt.com/',
        },
        signal: controller.signal,
        cache: 'no-store',
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        'Token 校验失败：access token 无效或已过期，请重新获取 Session Token'
      );
    }

    if (!response.ok) {
      throw buildTemporaryFailureError();
    }

    let payload: Record<string, any>;
    try {
      payload = (await response.json()) as Record<string, any>;
    } catch {
      throw buildTemporaryFailureError();
    }

    const accounts = asRecord(payload.accounts);
    if (Object.keys(accounts).length === 0) {
      throw new Error(
        'Token 校验失败：未获取到账号信息，请重新获取 Session Token'
      );
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
        error.message.includes('未获取到账号信息')
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
