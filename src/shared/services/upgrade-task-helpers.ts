export interface ResolvedSessionAccount {
  email: string;
  accountId: string;
  currentPlan: string;
  accessToken: string;
}

export interface UpgradeTaskMetadata {
  adminNote?: string;
  manualSuccessChannelId?: string;
  manualSuccessChannelName?: string;
  manualSuccessChannelCardkey?: string;
  manualRequired?: boolean;
  manualRequiredReason?: string;
  [key: string]: unknown;
}

function rejectPlusPlan(currentPlan: string) {
  if (normalizePlanType(currentPlan) === 'plus') {
    throw new Error('当前为 Plus 会员，请等会员到期后再进行充值升级');
  }
}

export function normalizePlanType(
  currentPlan: string | null | undefined
): string {
  return String(currentPlan || '')
    .trim()
    .toLowerCase();
}

function requireJsonField(value: string, fieldName: string): string {
  if (!value) {
    throw new Error(`Token 格式不正确：缺少 ${fieldName} 字段`);
  }
  return value;
}

function parseSessionTokenAsJson(sessionToken: string): any | null {
  try {
    const parsed = JSON.parse(sessionToken);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object'
    ? (value as Record<string, any>)
    : {};
}

function readClaimString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function extractJwtAccountSnapshot(
  token: string
): ResolvedSessionAccount | null {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const profile = asRecord(payload['https://api.openai.com/profile']);
  const auth = asRecord(payload['https://api.openai.com/auth']);
  const email = readClaimString(
    profile.email,
    payload['https://api.openai.com/profile.email'],
    payload.email
  );
  const accountId = readClaimString(
    auth.chatgpt_account_id,
    auth.chatgpt_user_id,
    payload['https://api.openai.com/auth.chatgpt_account_id'],
    payload['https://api.openai.com/auth.chatgpt_user_id'],
    payload.sub
  );
  const currentPlan = normalizePlanType(
    readClaimString(
      auth.chatgpt_plan_type,
      payload['https://api.openai.com/auth.chatgpt_plan_type']
    )
  );

  if (!email || !accountId || !currentPlan) {
    return null;
  }

  return {
    email,
    accountId,
    currentPlan,
    accessToken: token,
  };
}

export function extractAccessTokenAccountSnapshot(
  accessToken: string
): Partial<ResolvedSessionAccount> {
  return extractJwtAccountSnapshot(accessToken) || { accessToken };
}

export function extractSessionAccountSnapshot(
  sessionToken: string
): ResolvedSessionAccount {
  const parsed = parseSessionTokenAsJson(sessionToken);

  if (parsed) {
    const email = requireJsonField(parsed.user?.email || '', 'user.email');
    requireJsonField(parsed.user?.id || '', 'user.id');
    const accountId = requireJsonField(parsed.account?.id || '', 'account.id');
    const currentPlan = normalizePlanType(
      requireJsonField(parsed.account?.planType || '', 'account.planType')
    );
    const accessToken = requireJsonField(
      parsed.accessToken || '',
      'accessToken'
    );

    return {
      email,
      accountId,
      currentPlan,
      accessToken,
    };
  }

  const snapshot = extractJwtAccountSnapshot(sessionToken);
  if (snapshot) {
    return snapshot;
  }

  throw new Error('无法解析 Token，请粘贴完整的 Session Token 内容');
}

export function resolveSessionAccountPayload(
  sessionToken: string
): ResolvedSessionAccount {
  const snapshot = extractSessionAccountSnapshot(sessionToken);
  rejectPlusPlan(snapshot.currentPlan);
  return snapshot;
}

export function parseUpgradeTaskMetadata(
  metadata?: string | null
): UpgradeTaskMetadata {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeUpgradeTaskMetadata(
  metadata: string | null | undefined,
  next: Partial<UpgradeTaskMetadata>
): string | undefined {
  const merged: UpgradeTaskMetadata = {
    ...parseUpgradeTaskMetadata(metadata),
  };

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) {
      continue;
    }
    if (value === null || value === '') {
      delete merged[key];
      continue;
    }
    merged[key] = value;
  }

  return Object.keys(merged).length > 0 ? JSON.stringify(merged) : undefined;
}
