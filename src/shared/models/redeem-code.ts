import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { redeemCode, redeemCodeBatch, upgradeTask } from '@/config/db/schema';
import { dbTimestampNow } from '@/shared/lib/db-time';
import { getUuid } from '@/shared/lib/hash';
import { generateRedeemCode } from '@/shared/lib/redeem-code';

export type RedeemCode = typeof redeemCode.$inferSelect;
export type RedeemCodeBatch = typeof redeemCodeBatch.$inferSelect;

export enum RedeemCodeStatus {
  AVAILABLE = 'available',
  CONSUMED = 'consumed',
  DISABLED = 'disabled',
}

export type RedeemCodeUsageState = 'used' | 'unused' | 'disabled' | 'not_found';

export interface RedeemCodeUsageBatchItem {
  code: string;
  state: RedeemCodeUsageState;
  used: boolean;
  status: string | null;
  productCode: string | null;
  memberType: string | null;
  usedAt: Date | null;
  usedByEmail: string | null;
}

export interface RedeemCodeUsageBatchResult {
  items: RedeemCodeUsageBatchItem[];
  summary: {
    total: number;
    used: number;
    unused: number;
    disabled: number;
    notFound: number;
  };
}

interface RedeemCodeUsageQueryRow {
  code: string;
  status: string;
  productCode: string;
  memberType: string;
  usedAt: Date | null;
  usedByEmail: string | null;
}

// --- 批次 ID 用时间戳 ---

function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `B${ts}${rand}`;
}

// --- 批次操作 ---

export async function generateBatch(args: {
  productCode: string;
  memberType: string;
  count: number;
  unitPrice: string; // 元，如 "179.00"
  createdBy?: string;
}): Promise<{ batchId: string; title: string; codes: string[] }> {
  const batchId = generateBatchId();
  const title = `${args.productCode}-${args.memberType}-${batchId}`;
  const codes: string[] = [];

  await db().transaction(async (tx: any) => {
    await tx.insert(redeemCodeBatch).values({
      id: batchId,
      title,
      productCode: args.productCode,
      memberType: args.memberType,
      count: args.count,
      unitPrice: args.unitPrice,
      createdBy: args.createdBy,
      note: args.createdBy ? `由 ${args.createdBy} 创建` : undefined,
    });

    for (let i = 0; i < args.count; i++) {
      const code = generateRedeemCode();
      const id = getUuid();
      try {
        await tx.insert(redeemCode).values({
          id,
          batchId,
          code,
          productCode: args.productCode,
          memberType: args.memberType,
          status: RedeemCodeStatus.AVAILABLE,
        });
        codes.push(code);
      } catch {
        // unique 冲突，重试一次
        const retryCode = generateRedeemCode();
        await tx.insert(redeemCode).values({
          id: getUuid(),
          batchId,
          code: retryCode,
          productCode: args.productCode,
          memberType: args.memberType,
          status: RedeemCodeStatus.AVAILABLE,
        });
        codes.push(retryCode);
      }
    }
  });

  return { batchId, title, codes };
}

export async function getBatchList(page: number = 1, pageSize: number = 20) {
  const offset = (page - 1) * pageSize;
  const items = await db()
    .select()
    .from(redeemCodeBatch)
    .orderBy(desc(redeemCodeBatch.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db()
    .select({ total: count() })
    .from(redeemCodeBatch);

  return { items, total };
}

export async function getBatchById(batchId: string) {
  const [batch] = await db()
    .select()
    .from(redeemCodeBatch)
    .where(eq(redeemCodeBatch.id, batchId));
  return batch || null;
}

export async function getBatchStats(batchId: string) {
  const stats = await db()
    .select({
      status: redeemCode.status,
      count: count(),
    })
    .from(redeemCode)
    .where(eq(redeemCode.batchId, batchId))
    .groupBy(redeemCode.status);

  return stats;
}

// --- 卡密查询 ---

export async function getCodeList(args: {
  page?: number;
  pageSize?: number;
  status?: string;
  batchId?: string;
  productCode?: string;
  memberType?: string;
  search?: string;
}) {
  const { page = 1, pageSize = 20 } = args;
  const offset = (page - 1) * pageSize;
  const conditions = [];

  if (args.status) conditions.push(eq(redeemCode.status, args.status));
  if (args.batchId) conditions.push(eq(redeemCode.batchId, args.batchId));
  if (args.productCode)
    conditions.push(eq(redeemCode.productCode, args.productCode));
  if (args.memberType)
    conditions.push(eq(redeemCode.memberType, args.memberType));
  if (args.search)
    conditions.push(eq(redeemCode.code, args.search.toUpperCase()));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db()
    .select()
    .from(redeemCode)
    .where(where)
    .orderBy(desc(redeemCode.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db()
    .select({ total: count() })
    .from(redeemCode)
    .where(where);

  return { items, total };
}

export async function getCodeByCode(code: string) {
  const [result] = await db()
    .select()
    .from(redeemCode)
    .where(eq(redeemCode.code, code.toUpperCase()));
  return result || null;
}

export function normalizeRedeemCodeBatchInput(input: string[] | string) {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  const codes = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.toUpperCase());

  if (codes.length > 100) {
    throw new Error('最多查询 100 个卡密');
  }

  return codes;
}

function getRedeemCodeUsageState(status: string | null): RedeemCodeUsageState {
  if (status === RedeemCodeStatus.CONSUMED) return 'used';
  if (status === RedeemCodeStatus.AVAILABLE) return 'unused';
  if (status === RedeemCodeStatus.DISABLED) return 'disabled';
  return 'not_found';
}

export async function queryRedeemCodeUsageBatch(
  input: string[] | string
): Promise<RedeemCodeUsageBatchResult> {
  const displayCodes = (Array.isArray(input) ? input : input.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  const codes = normalizeRedeemCodeBatchInput(input);
  const summary: RedeemCodeUsageBatchResult['summary'] = {
    total: codes.length,
    used: 0,
    unused: 0,
    disabled: 0,
    notFound: 0,
  };

  if (codes.length === 0) {
    return { items: [], summary };
  }

  const uniqueCodes = Array.from(new Set(codes));
  const rows = (await db()
    .select({
      code: redeemCode.code,
      status: redeemCode.status,
      productCode: redeemCode.productCode,
      memberType: redeemCode.memberType,
      usedAt: redeemCode.usedAt,
      usedByEmail: upgradeTask.chatgptEmail,
    })
    .from(redeemCode)
    .leftJoin(upgradeTask, eq(redeemCode.usedByTaskId, upgradeTask.id))
    .where(
      sql`upper(${redeemCode.code}) IN ${uniqueCodes}`
    )) as RedeemCodeUsageQueryRow[];

  const byCode = new Map(rows.map((row) => [row.code.toUpperCase(), row]));
  const items = codes.map((code, index) => {
    const row = byCode.get(code);
    const state = getRedeemCodeUsageState(row?.status || null);
    if (state === 'used') summary.used += 1;
    if (state === 'unused') summary.unused += 1;
    if (state === 'disabled') summary.disabled += 1;
    if (state === 'not_found') summary.notFound += 1;

    return {
      code: row?.code || displayCodes[index],
      state,
      used: state === 'used',
      status: row?.status || null,
      productCode: row?.productCode || null,
      memberType: row?.memberType || null,
      usedAt: row?.usedAt || null,
      usedByEmail: row?.usedByEmail || null,
    };
  });

  return { items, summary };
}

// --- 卡密核心操作 ---

/**
 * 消耗卡密（在事务中调用，FOR UPDATE 锁行）
 */
export async function consumeCode(
  tx: any,
  code: string,
  taskId: string
): Promise<
  | { ok: true; codeId: string; productCode: string; memberType: string }
  | { ok: false; reason: string }
> {
  const [row] = await tx
    .select()
    .from(redeemCode)
    .where(eq(redeemCode.code, code.toUpperCase()))
    .for('update');

  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status === RedeemCodeStatus.DISABLED)
    return { ok: false, reason: 'disabled' };
  if (row.status === RedeemCodeStatus.CONSUMED)
    return { ok: false, reason: 'already_consumed' };

  await tx
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.CONSUMED,
      usedByTaskId: taskId,
      usedAt: dbTimestampNow(),
    })
    .where(eq(redeemCode.id, row.id));

  return {
    ok: true,
    codeId: row.id,
    productCode: row.productCode,
    memberType: row.memberType,
  };
}

/**
 * 标记卡密为已消费（升级成功后，兼容旧调用）
 */
export async function markCodeConsumed(codeId: string) {
  await db()
    .update(redeemCode)
    .set({ status: RedeemCodeStatus.CONSUMED })
    .where(eq(redeemCode.id, codeId));
}

/**
 * 回滚卡密（升级失败后释放）
 */
export async function rollbackCode(codeId: string) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.AVAILABLE,
      usedByTaskId: null,
      usedAt: null,
    })
    .where(eq(redeemCode.id, codeId));
}

/**
 * 禁用卡密
 */
export async function disableCode(codeId: string, reason?: string) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.DISABLED,
      disabledAt: dbTimestampNow(),
      disabledReason: reason,
    })
    .where(eq(redeemCode.id, codeId));
}

/**
 * 启用卡密（从 disabled 恢复到 available）
 */
export async function enableCode(codeId: string) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.AVAILABLE,
      disabledAt: null,
      disabledReason: null,
    })
    .where(
      and(
        eq(redeemCode.id, codeId),
        eq(redeemCode.status, RedeemCodeStatus.DISABLED)
      )
    );
}

// --- 批量操作 ---

export async function batchDisable(codeIds: string[], reason?: string) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.DISABLED,
      disabledAt: dbTimestampNow(),
      disabledReason: reason,
    })
    .where(
      and(
        inArray(redeemCode.id, codeIds),
        eq(redeemCode.status, RedeemCodeStatus.AVAILABLE)
      )
    );
}

export async function batchEnable(codeIds: string[]) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.AVAILABLE,
      disabledAt: null,
      disabledReason: null,
    })
    .where(
      and(
        inArray(redeemCode.id, codeIds),
        eq(redeemCode.status, RedeemCodeStatus.DISABLED)
      )
    );
}

export async function batchDelete(codeIds: string[]) {
  await db()
    .delete(redeemCode)
    .where(
      and(
        inArray(redeemCode.id, codeIds),
        inArray(redeemCode.status, [
          RedeemCodeStatus.AVAILABLE,
          RedeemCodeStatus.DISABLED,
        ])
      )
    );
}

// --- 导出 ---

export async function exportCodesToCsv(args: {
  batchId?: string;
  productCode?: string;
  memberType?: string;
  status?: string;
}): Promise<string> {
  const conditions = [];
  if (args.batchId) conditions.push(eq(redeemCode.batchId, args.batchId));
  if (args.productCode)
    conditions.push(eq(redeemCode.productCode, args.productCode));
  if (args.memberType)
    conditions.push(eq(redeemCode.memberType, args.memberType));
  if (args.status) conditions.push(eq(redeemCode.status, args.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const codes = await db()
    .select({
      code: redeemCode.code,
      productCode: redeemCode.productCode,
      memberType: redeemCode.memberType,
      status: redeemCode.status,
    })
    .from(redeemCode)
    .where(where)
    .orderBy(redeemCode.createdAt);

  const lines = ['卡密,产品,会员类型,状态'];
  for (const c of codes) {
    lines.push(`${c.code},${c.productCode},${c.memberType},${c.status}`);
  }

  return lines.join('\n');
}
