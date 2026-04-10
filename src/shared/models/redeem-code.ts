import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { redeemCode, redeemCodeBatch } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import {
  generateRedeemCode,
  productCodeToPrefix,
} from '@/shared/lib/redeem-code';

export type RedeemCode = typeof redeemCode.$inferSelect;
export type RedeemCodeBatch = typeof redeemCodeBatch.$inferSelect;

export enum RedeemCodeStatus {
  AVAILABLE = 'available',
  CONSUMING = 'consuming',
  CONSUMED = 'consumed',
  DISABLED = 'disabled',
}

// --- 批次操作 ---

export async function generateBatch(args: {
  productCode: string;
  count: number;
  unitPrice: number;
  title: string;
  createdBy?: string;
}): Promise<{ batchId: string; codes: string[] }> {
  const batchId = getUuid();
  const prefix = productCodeToPrefix(args.productCode);
  const codes: string[] = [];

  await db().transaction(async (tx: any) => {
    await tx.insert(redeemCodeBatch).values({
      id: batchId,
      title: args.title,
      productCode: args.productCode,
      count: args.count,
      unitPrice: args.unitPrice,
      createdBy: args.createdBy,
    });

    for (let i = 0; i < args.count; i++) {
      const code = generateRedeemCode(prefix);
      const id = getUuid();
      try {
        await tx.insert(redeemCode).values({
          id,
          batchId,
          code,
          productCode: args.productCode,
          status: RedeemCodeStatus.AVAILABLE,
        });
        codes.push(code);
      } catch {
        // unique 冲突，重试一次
        const retryCode = generateRedeemCode(prefix);
        await tx.insert(redeemCode).values({
          id: getUuid(),
          batchId,
          code: retryCode,
          productCode: args.productCode,
          status: RedeemCodeStatus.AVAILABLE,
        });
        codes.push(retryCode);
      }
    }
  });

  return { batchId, codes };
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
  search?: string;
}) {
  const { page = 1, pageSize = 20 } = args;
  const offset = (page - 1) * pageSize;
  const conditions = [];

  if (args.status) conditions.push(eq(redeemCode.status, args.status));
  if (args.batchId) conditions.push(eq(redeemCode.batchId, args.batchId));
  if (args.productCode)
    conditions.push(eq(redeemCode.productCode, args.productCode));
  if (args.search) conditions.push(eq(redeemCode.code, args.search));

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

// --- 卡密核心操作 ---

/**
 * 消耗卡密（在事务中调用）
 * 必须配合 FOR UPDATE 锁行
 */
export async function consumeCode(
  tx: any,
  code: string,
  taskId: string
): Promise<
  | { ok: true; codeId: string; productCode: string }
  | { ok: false; reason: string }
> {
  // PG: SELECT ... FOR UPDATE
  const [row] = await tx
    .select()
    .from(redeemCode)
    .where(eq(redeemCode.code, code.toUpperCase()))
    .for('update');

  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status === RedeemCodeStatus.DISABLED)
    return { ok: false, reason: 'disabled' };
  if (row.status === RedeemCodeStatus.CONSUMING)
    return { ok: false, reason: 'already_in_use' };
  if (row.status === RedeemCodeStatus.CONSUMED)
    return { ok: false, reason: 'already_consumed' };

  await tx
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.CONSUMING,
      usedByTaskId: taskId,
      usedAt: new Date(),
    })
    .where(eq(redeemCode.id, row.id));

  return { ok: true, codeId: row.id, productCode: row.productCode };
}

/**
 * 标记卡密为已消费（升级成功后）
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
      disabledAt: new Date(),
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

/**
 * 批量禁用（仅未使用的）
 */
export async function batchDisable(codeIds: string[], reason?: string) {
  await db()
    .update(redeemCode)
    .set({
      status: RedeemCodeStatus.DISABLED,
      disabledAt: new Date(),
      disabledReason: reason,
    })
    .where(
      and(
        inArray(redeemCode.id, codeIds),
        eq(redeemCode.status, RedeemCodeStatus.AVAILABLE)
      )
    );
}

/**
 * 批量启用
 */
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

/**
 * 批量删除（仅 available 或 disabled 的）
 */
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

// --- 导入 ---

/**
 * 导入已有卡密（如旧发卡网库存）
 */
export async function importCodes(args: {
  codes: string[];
  productCode: string;
  batchTitle: string;
  createdBy?: string;
}): Promise<{ batchId: string; importedCount: number; skippedCount: number }> {
  const batchId = getUuid();
  let importedCount = 0;
  let skippedCount = 0;

  await db().transaction(async (tx: any) => {
    await tx.insert(redeemCodeBatch).values({
      id: batchId,
      title: args.batchTitle,
      productCode: args.productCode,
      count: args.codes.length,
      unitPrice: 0,
      createdBy: args.createdBy,
    });

    for (const code of args.codes) {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        skippedCount++;
        continue;
      }
      try {
        await tx.insert(redeemCode).values({
          id: getUuid(),
          batchId,
          code: trimmed,
          productCode: args.productCode,
          status: RedeemCodeStatus.AVAILABLE,
        });
        importedCount++;
      } catch {
        skippedCount++;
      }
    }
  });

  return { batchId, importedCount, skippedCount };
}

// --- 导出 ---

/**
 * 导出批次卡密为 CSV 字符串
 */
export async function exportBatchToCsv(batchId: string): Promise<string> {
  const codes = await db()
    .select({
      code: redeemCode.code,
      productCode: redeemCode.productCode,
      status: redeemCode.status,
    })
    .from(redeemCode)
    .where(eq(redeemCode.batchId, batchId))
    .orderBy(redeemCode.createdAt);

  const lines = ['卡密,产品,状态'];
  for (const c of codes) {
    lines.push(`${c.code},${c.productCode},${c.status}`);
  }

  // 标记为已导出
  await db()
    .update(redeemCode)
    .set({ exportedAt: new Date() })
    .where(
      and(
        eq(redeemCode.batchId, batchId),
        eq(redeemCode.status, RedeemCodeStatus.AVAILABLE)
      )
    );

  return lines.join('\n');
}
