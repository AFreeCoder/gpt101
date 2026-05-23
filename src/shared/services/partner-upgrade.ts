import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { and, count, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  redeemCode,
  redeemCodeBatch,
  upgradePartnerApp,
  upgradePartnerAuditLog,
  upgradePartnerNonce,
  upgradePartnerOrder,
  upgradeTask,
} from '@/config/db/schema';
import { dbTimestampNow } from '@/shared/lib/db-time';
import { getUuid } from '@/shared/lib/hash';
import { getMemberTypes } from '@/shared/lib/redeem-code';
import { RedeemCodeStatus, type RedeemCode } from '@/shared/models/redeem-code';
import {
  queryTaskStatus,
  resolveAccount,
  submitUpgradeTask,
  type PublicTaskStatus,
} from '@/shared/services/upgrade-task';
import type { ResolvedSessionAccount } from '@/shared/services/upgrade-task-helpers';

export type UpgradePartnerApp = typeof upgradePartnerApp.$inferSelect;
export type UpgradePartnerOrder = typeof upgradePartnerOrder.$inferSelect;

const SIGNATURE_TTL_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;
const FAILED_AUDIT_WINDOW_MS = 60 * 1000;
const FAILED_AUDIT_MAX_PER_WINDOW = 20;

const failedAuditWindows = new Map<
  string,
  { windowStartMs: number; count: number }
>();

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function hmacSha256Hex(secret: string, input: string) {
  return createHmac('sha256', secret).update(input).digest('hex');
}

function isDuplicateKeyError(err: any) {
  return (
    err?.code === '23505' ||
    err?.cause?.code === '23505' ||
    String(err?.message || '').includes('duplicate key')
  );
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function canonicalPartnerSignaturePayload(args: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
}) {
  return [
    args.method.toUpperCase(),
    args.path,
    args.timestamp,
    args.nonce,
    sha256Hex(args.rawBody),
  ].join('\n');
}

function getRequiredHeader(headers: Headers, name: string) {
  const value = headers.get(name)?.trim();
  if (!value) throw new Error(`缺少 ${name} 请求头`);
  return value;
}

function shouldTrustProxyHeaders() {
  return process.env.PARTNER_TRUSTED_PROXY_HEADERS === 'true';
}

function getClientIp(headers: Headers) {
  if (!shouldTrustProxyHeaders()) return '';

  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    ''
  );
}

function parseJsonArrayField(value: string | null): unknown[] {
  if (!value?.trim()) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function isProductAllowed(
  app: UpgradePartnerApp,
  productCode: string,
  memberType: string
) {
  assertKnownProductMember(productCode, memberType);

  const allowedProducts = parseJsonArrayField(app.allowedProducts);
  if (allowedProducts.length === 0) {
    throw new Error('接入方未配置可用商品');
  }

  return allowedProducts.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const product = (item as any).productCode;
    const member = (item as any).memberType;

    assertAllowedProductConfig(product, member);

    return (
      product === productCode &&
      (member === memberType || member === '*' || member === undefined)
    );
  });
}

function assertPartnerProductAllowed(
  app: UpgradePartnerApp,
  productCode: string,
  memberType: string
) {
  try {
    if (isProductAllowed(app, productCode, memberType)) return;
  } catch (err: any) {
    if (err?.message === '接入方未配置可用商品') throw err;
    if (err?.message === '商品或会员类型无效') throw err;
    throw new Error('接入方商品配置无效');
  }

  throw new Error('接入方不支持该商品');
}

function assertKnownProductMember(productCode: string, memberType: string) {
  const memberTypes = getMemberTypes(productCode);
  if (!memberTypes.some((member) => member.code === memberType)) {
    throw new Error('商品或会员类型无效');
  }
}

function assertAllowedProductConfig(productCode: unknown, memberType: unknown) {
  if (typeof productCode !== 'string' || !productCode.trim()) {
    throw new Error('接入方商品配置无效');
  }
  if (memberType === undefined || memberType === '*') {
    if (getMemberTypes(productCode).length === 0) {
      throw new Error('接入方商品配置无效');
    }
    return;
  }
  if (typeof memberType !== 'string' || !memberType.trim()) {
    throw new Error('接入方商品配置无效');
  }
  if (
    !getMemberTypes(productCode).some((member) => member.code === memberType)
  ) {
    throw new Error('接入方商品配置无效');
  }
}

function assertPartnerIpAllowed(app: UpgradePartnerApp, clientIp: string) {
  const allowlist = app.ipAllowlist
    ?.split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!allowlist || allowlist.length === 0) return;
  if (clientIp && allowlist.includes(clientIp)) return;

  throw new Error('当前 IP 不允许调用该接入方接口');
}

async function getPartnerAppByKey(appKey: string) {
  const [app] = await db()
    .select()
    .from(upgradePartnerApp)
    .where(eq(upgradePartnerApp.appKey, appKey))
    .limit(1);

  return app || null;
}

async function assertPartnerRateLimit(app: UpgradePartnerApp, now: Date) {
  const limit = app.rateLimitPerMinute;
  if (!limit || limit <= 0) return;

  const windowStart = new Date(now.getTime() - 60_000);
  const [usage] = await db()
    .select({ value: count() })
    .from(upgradePartnerNonce)
    .where(
      and(
        eq(upgradePartnerNonce.partnerAppId, app.id),
        gte(upgradePartnerNonce.createdAt, windowStart)
      )
    );

  if ((usage?.value || 0) >= limit) {
    throw new Error('请求过于频繁');
  }
}

async function cleanupExpiredPartnerNonces(app: UpgradePartnerApp, now: Date) {
  await db()
    .delete(upgradePartnerNonce)
    .where(
      and(
        eq(upgradePartnerNonce.partnerAppId, app.id),
        lt(upgradePartnerNonce.expiresAt, now)
      )
    );
}

async function recordPartnerAuditLog(args: {
  app?: UpgradePartnerApp | null;
  appKey?: string;
  nonce?: string;
  method: string;
  path: string;
  rawBody: string;
  clientIp: string;
  outcome: 'success' | 'failed';
  errorMessage?: string;
  now?: Date;
}) {
  const appKey = args.app?.appKey || args.appKey || 'unknown';
  if (args.outcome === 'failed' && !shouldRecordFailedPartnerAuditLog(args)) {
    return;
  }

  try {
    await db()
      .insert(upgradePartnerAuditLog)
      .values({
        id: getUuid(),
        partnerAppId: args.app?.id || null,
        appKey,
        nonce: args.nonce || null,
        method: args.method.toUpperCase(),
        path: args.path,
        requestBodyHash: sha256Hex(args.rawBody),
        clientIp: args.clientIp || null,
        outcome: args.outcome,
        errorMessage: args.errorMessage?.slice(0, 500) || null,
      });
  } catch {
    // Audit logging must not turn a valid request into a failed request.
  }
}

function shouldRecordFailedPartnerAuditLog(args: {
  app?: UpgradePartnerApp | null;
  appKey?: string;
  path: string;
  clientIp: string;
  now?: Date;
}) {
  const nowMs = (args.now || new Date()).getTime();
  const key = [
    args.app?.id || args.appKey || 'unknown',
    args.clientIp || 'unknown-ip',
    args.path,
  ].join('|');
  const current = failedAuditWindows.get(key);

  if (!current || nowMs - current.windowStartMs >= FAILED_AUDIT_WINDOW_MS) {
    failedAuditWindows.set(key, { windowStartMs: nowMs, count: 1 });
    if (failedAuditWindows.size > 1000) cleanupFailedAuditWindows(nowMs);
    return true;
  }

  if (current.count >= FAILED_AUDIT_MAX_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  return true;
}

function cleanupFailedAuditWindows(nowMs: number) {
  for (const [key, value] of failedAuditWindows) {
    if (nowMs - value.windowStartMs >= FAILED_AUDIT_WINDOW_MS) {
      failedAuditWindows.delete(key);
    }
  }
}

function createPartnerRedeemCode(appKey: string, externalOrderNo: string) {
  const digest = sha256Hex(`${appKey}:${externalOrderNo}`).toUpperCase();
  return `GPT101-${digest.slice(0, 32)}`;
}

function createPartnerBatchId(appKey: string, externalOrderNo: string) {
  return `PARTNER-${sha256Hex(`${appKey}:${externalOrderNo}`).slice(0, 20)}`;
}

function normalizeRequiredString(value: unknown, message: string) {
  if (typeof value !== 'string') throw new Error(message);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function generatePartnerSecret() {
  return `sk_${randomBytes(32).toString('hex')}`;
}

function generatePartnerAppKey(prefix?: string) {
  const normalizedPrefix = (prefix || 'partner')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

  return `${normalizedPrefix || 'partner'}_${randomBytes(12).toString('hex')}`;
}

async function findPartnerOrder(
  app: UpgradePartnerApp,
  externalOrderNo: string
) {
  const [order] = await db()
    .select()
    .from(upgradePartnerOrder)
    .where(
      and(
        eq(upgradePartnerOrder.partnerAppId, app.id),
        eq(upgradePartnerOrder.externalOrderNo, externalOrderNo)
      )
    )
    .limit(1);

  return order || null;
}

async function findTaskByRedeemCodeId(redeemCodeId: string) {
  const [task] = await db()
    .select()
    .from(upgradeTask)
    .where(eq(upgradeTask.redeemCodeId, redeemCodeId))
    .orderBy(desc(upgradeTask.createdAt))
    .limit(1);

  return task || null;
}

async function findTaskByTaskNo(taskNo: string) {
  const [task] = await db()
    .select()
    .from(upgradeTask)
    .where(eq(upgradeTask.taskNo, taskNo))
    .limit(1);

  return task || null;
}

async function getRedeemCodeById(redeemCodeId: string): Promise<RedeemCode> {
  const [code] = await db()
    .select()
    .from(redeemCode)
    .where(eq(redeemCode.id, redeemCodeId))
    .limit(1);

  if (!code) throw new Error('内部升级凭证不存在');
  return code;
}

export async function authenticatePartnerRequest(args: {
  method: string;
  path: string;
  headers: Headers;
  rawBody: string;
  now?: Date;
}): Promise<{ app: UpgradePartnerApp }> {
  const now = args.now || new Date();
  const clientIp = getClientIp(args.headers);
  let app: UpgradePartnerApp | null = null;
  let appKey = args.headers.get('x-gpt101-app-key')?.trim() || '';
  let nonce = args.headers.get('x-gpt101-nonce')?.trim() || '';

  try {
    appKey = getRequiredHeader(args.headers, 'x-gpt101-app-key');
    const timestamp = getRequiredHeader(args.headers, 'x-gpt101-timestamp');
    nonce = getRequiredHeader(args.headers, 'x-gpt101-nonce');
    const signature = getRequiredHeader(args.headers, 'x-gpt101-signature');
    app = await getPartnerAppByKey(appKey);
    const timestampMs = Number(timestamp) * 1000;

    if (!app || app.status !== 'active') {
      throw new Error('接入方无效或已禁用');
    }

    if (!Number.isFinite(timestampMs)) {
      throw new Error('请求时间戳无效');
    }

    if (Math.abs(now.getTime() - timestampMs) > SIGNATURE_TTL_MS) {
      throw new Error('请求时间戳已过期');
    }

    assertPartnerIpAllowed(app, clientIp);

    const canonical = canonicalPartnerSignaturePayload({
      method: args.method,
      path: args.path,
      timestamp,
      nonce,
      rawBody: args.rawBody,
    });
    const expectedSignature = hmacSha256Hex(app.appSecret, canonical);

    if (!safeEqualHex(signature, expectedSignature)) {
      throw new Error('请求签名无效');
    }

    await cleanupExpiredPartnerNonces(app, now);
    await assertPartnerRateLimit(app, now);

    await db()
      .insert(upgradePartnerNonce)
      .values({
        id: getUuid(),
        partnerAppId: app.id,
        appKey: app.appKey,
        nonce,
        method: args.method.toUpperCase(),
        path: args.path,
        bodyHash: sha256Hex(args.rawBody),
        clientIp,
        expiresAt: new Date(now.getTime() + NONCE_TTL_MS),
      });

    await recordPartnerAuditLog({
      app,
      appKey,
      nonce,
      method: args.method,
      path: args.path,
      rawBody: args.rawBody,
      clientIp,
      outcome: 'success',
      now,
    });

    return { app };
  } catch (err: any) {
    const message = err?.message || 'partner 鉴权失败';
    await recordPartnerAuditLog({
      app,
      appKey,
      nonce,
      method: args.method,
      path: args.path,
      rawBody: args.rawBody,
      clientIp,
      outcome: 'failed',
      errorMessage: message,
      now,
    });

    if (isDuplicateKeyError(err)) {
      throw new Error('重复请求');
    }
    throw err;
  }
}

export async function createPartnerApp(args: {
  name: string;
  appKeyPrefix?: string;
  allowedProducts?: Array<{ productCode: string; memberType?: string }>;
  ipAllowlist?: string[];
  rateLimitPerMinute?: number;
  note?: string;
}): Promise<{ app: UpgradePartnerApp; appSecret: string }> {
  const name = normalizeRequiredString(args.name, '缺少接入方名称');
  const appSecret = generatePartnerSecret();
  const [app] = await db()
    .insert(upgradePartnerApp)
    .values({
      id: getUuid(),
      appKey: generatePartnerAppKey(args.appKeyPrefix),
      appSecret,
      name,
      status: 'active',
      allowedProducts: args.allowedProducts
        ? JSON.stringify(args.allowedProducts)
        : null,
      ipAllowlist: args.ipAllowlist?.join(',') || null,
      rateLimitPerMinute: args.rateLimitPerMinute ?? 120,
      note: args.note,
    })
    .returning();

  return { app, appSecret };
}

export async function rotatePartnerAppSecret(
  appId: string
): Promise<{ app: UpgradePartnerApp; appSecret: string }> {
  const appSecret = generatePartnerSecret();
  const [app] = await db()
    .update(upgradePartnerApp)
    .set({
      appSecret,
      updatedAt: dbTimestampNow(),
    })
    .where(eq(upgradePartnerApp.id, appId))
    .returning();

  if (!app) throw new Error('接入方不存在');

  return { app, appSecret };
}

export function assertPartnerRequestIsSecure(req: Request) {
  if (process.env.NODE_ENV !== 'production') return;

  const forwardedProto = shouldTrustProxyHeaders()
    ? req.headers.get('x-forwarded-proto')?.trim()
    : undefined;
  const protocol = forwardedProto || new URL(req.url).protocol.replace(':', '');

  if (protocol !== 'https') {
    throw new Error('partner API 仅支持 HTTPS');
  }
}

export async function readAuthenticatedPartnerJson(req: Request) {
  assertPartnerRequestIsSecure(req);

  const rawBody = await req.text();
  const { app } = await authenticatePartnerRequest({
    method: req.method,
    path: new URL(req.url).pathname,
    headers: req.headers,
    rawBody,
  });
  const body = rawBody ? JSON.parse(rawBody) : {};

  return { app, body, rawBody };
}

export async function authenticatePartnerGetRequest(req: Request) {
  assertPartnerRequestIsSecure(req);

  const { app } = await authenticatePartnerRequest({
    method: req.method,
    path: new URL(req.url).pathname,
    headers: req.headers,
    rawBody: '',
  });

  return { app };
}

export async function verifyPartnerOrder(args: {
  app: UpgradePartnerApp;
  externalOrderNo: string;
  productCode: string;
  memberType: string;
}): Promise<{
  valid: true;
  orderId: string;
  externalOrderNo: string;
  productCode: string;
  memberType: string;
  redeemCodeId: string;
}> {
  const externalOrderNo = normalizeRequiredString(
    args.externalOrderNo,
    '缺少外部订单号'
  );
  const productCode = normalizeRequiredString(args.productCode, '缺少产品类型');
  const memberType = normalizeRequiredString(args.memberType, '缺少会员类型');

  const result = await db()
    .transaction(async (tx: any) => {
      const [existingOrder] = await tx
        .select()
        .from(upgradePartnerOrder)
        .where(
          and(
            eq(upgradePartnerOrder.partnerAppId, args.app.id),
            eq(upgradePartnerOrder.externalOrderNo, externalOrderNo)
          )
        )
        .limit(1)
        .for('update');

      if (existingOrder) {
        if (
          existingOrder.productCode !== productCode ||
          existingOrder.memberType !== memberType
        ) {
          throw new Error('外部订单商品不一致');
        }

        return existingOrder;
      }

      assertPartnerProductAllowed(args.app, productCode, memberType);

      const redeemCodeId = getUuid();
      const orderId = getUuid();
      const batchId = createPartnerBatchId(args.app.appKey, externalOrderNo);
      const code = createPartnerRedeemCode(args.app.appKey, externalOrderNo);

      await tx.insert(redeemCodeBatch).values({
        id: batchId,
        title: `${args.app.appKey}-${externalOrderNo}`,
        productCode,
        memberType,
        count: 1,
        unitPrice: '0.00',
        createdBy: `partner:${args.app.appKey}`,
        note: `partner order ${externalOrderNo}`,
      });

      await tx.insert(redeemCode).values({
        id: redeemCodeId,
        batchId,
        code,
        productCode,
        memberType,
        status: RedeemCodeStatus.AVAILABLE,
      });

      const [createdOrder] = await tx
        .insert(upgradePartnerOrder)
        .values({
          id: orderId,
          partnerAppId: args.app.id,
          externalOrderNo,
          productCode,
          memberType,
          redeemCodeId,
          status: 'verified',
        })
        .returning();

      return createdOrder;
    })
    .catch(async (err: any) => {
      const existingOrder = await findPartnerOrder(args.app, externalOrderNo);
      if (!existingOrder) throw err;
      if (
        existingOrder.productCode !== productCode ||
        existingOrder.memberType !== memberType
      ) {
        throw new Error('外部订单商品不一致');
      }
      return existingOrder;
    });

  return {
    valid: true,
    orderId: result.id,
    externalOrderNo: result.externalOrderNo,
    productCode: result.productCode,
    memberType: result.memberType,
    redeemCodeId: result.redeemCodeId,
  };
}

export async function resolvePartnerAccount(
  args: {
    app: UpgradePartnerApp;
    externalOrderNo: string;
    sessionToken: string;
  },
  options?: {
    accountResolver?: (sessionToken: string) => Promise<ResolvedSessionAccount>;
  }
) {
  const externalOrderNo = normalizeRequiredString(
    args.externalOrderNo,
    '缺少外部订单号'
  );
  const sessionToken = normalizeRequiredString(
    args.sessionToken,
    '请输入 session token'
  );
  const order = await findPartnerOrder(args.app, externalOrderNo);

  if (!order) throw new Error('外部订单不存在');

  const account = options?.accountResolver
    ? await options.accountResolver(sessionToken)
    : await resolveAccount(sessionToken);

  return {
    email: account.email,
    accountId: account.accountId,
    currentPlan: account.currentPlan,
  };
}

export async function submitPartnerUpgradeTask(
  args: {
    app: UpgradePartnerApp;
    externalOrderNo: string;
    sessionToken: string;
    chatgptEmail: string;
    chatgptAccountId?: string;
    chatgptCurrentPlan?: string;
    clientIp?: string;
    userAgent?: string;
  },
  options?: {
    accountResolver?: (sessionToken: string) => Promise<ResolvedSessionAccount>;
  }
): Promise<{ taskNo: string }> {
  const externalOrderNo = normalizeRequiredString(
    args.externalOrderNo,
    '缺少外部订单号'
  );
  const sessionToken = normalizeRequiredString(
    args.sessionToken,
    '请输入 session token'
  );
  const order = await findPartnerOrder(args.app, externalOrderNo);

  if (!order) throw new Error('外部订单不存在');

  if (order.taskId) {
    const [task] = await db()
      .select()
      .from(upgradeTask)
      .where(eq(upgradeTask.id, order.taskId))
      .limit(1);
    if (task) return { taskNo: task.taskNo };
  }

  const existingTask = await findTaskByRedeemCodeId(order.redeemCodeId);
  if (existingTask) {
    await db()
      .update(upgradePartnerOrder)
      .set({
        taskId: existingTask.id,
        status: 'submitted',
        updatedAt: dbTimestampNow(),
      })
      .where(eq(upgradePartnerOrder.id, order.id));
    return { taskNo: existingTask.taskNo };
  }

  const code = await getRedeemCodeById(order.redeemCodeId);
  let result: { taskNo: string };
  try {
    result = await submitUpgradeTask(
      {
        code: code.code,
        sessionToken,
        chatgptEmail: args.chatgptEmail,
        chatgptAccountId: args.chatgptAccountId,
        chatgptCurrentPlan: args.chatgptCurrentPlan,
        clientIp: args.clientIp,
        userAgent: args.userAgent,
        metadata: {
          partnerAppKey: args.app.appKey,
          partnerOrderId: order.id,
          externalOrderNo,
        },
      },
      options
    );
  } catch (err) {
    const racedTask = await findTaskByRedeemCodeId(order.redeemCodeId);
    if (!racedTask) throw err;
    result = { taskNo: racedTask.taskNo };
  }
  const task = await findTaskByTaskNo(result.taskNo);

  if (task) {
    await db()
      .update(upgradePartnerOrder)
      .set({
        taskId: task.id,
        status: 'submitted',
        updatedAt: dbTimestampNow(),
      })
      .where(eq(upgradePartnerOrder.id, order.id));
  }

  return result;
}

export async function queryPartnerTaskStatus(args: {
  app: UpgradePartnerApp;
  taskNo: string;
}): Promise<PublicTaskStatus | null> {
  const taskNo = normalizeRequiredString(args.taskNo, '缺少任务编号');
  const task = await findTaskByTaskNo(taskNo);

  if (!task) return null;

  const [order] = await db()
    .select()
    .from(upgradePartnerOrder)
    .where(
      and(
        eq(upgradePartnerOrder.partnerAppId, args.app.id),
        eq(upgradePartnerOrder.taskId, task.id)
      )
    )
    .limit(1);

  if (!order) return null;

  return queryTaskStatus(taskNo);
}
