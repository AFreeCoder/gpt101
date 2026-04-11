import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { channelCardkey } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export type ChannelCardkey = typeof channelCardkey.$inferSelect;

export enum ChannelCardkeyStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  USED = 'used',
  DISABLED = 'disabled',
}

// --- 查询 ---

export async function getCardkeyList(args: {
  channelId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  productCode?: string;
  memberType?: string;
}) {
  const { page = 1, pageSize = 20 } = args;
  const offset = (page - 1) * pageSize;
  const conditions = [eq(channelCardkey.channelId, args.channelId)];

  if (args.status) conditions.push(eq(channelCardkey.status, args.status));
  if (args.productCode) conditions.push(eq(channelCardkey.productCode, args.productCode));
  if (args.memberType) conditions.push(eq(channelCardkey.memberType, args.memberType));

  const where = and(...conditions);

  const items = await db()
    .select()
    .from(channelCardkey)
    .where(where)
    .orderBy(desc(channelCardkey.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db()
    .select({ total: count() })
    .from(channelCardkey)
    .where(where);

  return { items, total };
}

/**
 * 获取渠道可用卡密数量
 */
export async function getAvailableCount(
  channelId: string,
  productCode?: string
): Promise<number> {
  const conditions = [
    eq(channelCardkey.channelId, channelId),
    eq(channelCardkey.status, ChannelCardkeyStatus.AVAILABLE),
  ];
  if (productCode) {
    conditions.push(eq(channelCardkey.productCode, productCode));
  }

  const [{ total }] = await db()
    .select({ total: count() })
    .from(channelCardkey)
    .where(and(...conditions));

  return total;
}

// --- 导入 ---

/**
 * 批量导入渠道卡密（粘贴多行文本）
 */
export async function importCardkeys(args: {
  channelId: string;
  productCode: string;
  memberType: string;
  cardkeys: string[];
}): Promise<{ importedCount: number; skippedCount: number }> {
  let importedCount = 0;
  let skippedCount = 0;

  // 先查出该渠道下已有的卡密，用于去重
  const existing = await db()
    .select({ cardkey: channelCardkey.cardkey })
    .from(channelCardkey)
    .where(eq(channelCardkey.channelId, args.channelId));
  const existingSet = new Set(existing.map((e) => e.cardkey));

  await db().transaction(async (tx: any) => {
    for (const key of args.cardkeys) {
      const trimmed = key.trim();
      if (!trimmed) {
        skippedCount++;
        continue;
      }
      if (existingSet.has(trimmed)) {
        skippedCount++;
        continue;
      }
      await tx.insert(channelCardkey).values({
        id: getUuid(),
        channelId: args.channelId,
        cardkey: trimmed,
        productCode: args.productCode,
        memberType: args.memberType,
        status: ChannelCardkeyStatus.AVAILABLE,
      });
      existingSet.add(trimmed); // 防止同一批导入内重复
      importedCount++;
    }
  });

  return { importedCount, skippedCount };
}

// --- 锁定/释放/使用 ---

/**
 * 从渠道库存池中锁定一张可用卡密（PG FOR UPDATE SKIP LOCKED）
 */
export async function acquireCardkey(
  tx: any,
  channelId: string,
  productCode: string,
  taskId: string
): Promise<ChannelCardkey | null> {
  // FOR UPDATE SKIP LOCKED 确保并发安全
  const [row] = await tx
    .select()
    .from(channelCardkey)
    .where(
      and(
        eq(channelCardkey.channelId, channelId),
        eq(channelCardkey.productCode, productCode),
        eq(channelCardkey.status, ChannelCardkeyStatus.AVAILABLE)
      )
    )
    .orderBy(channelCardkey.createdAt)
    .limit(1)
    .for('update', { skipLocked: true });

  if (!row) return null;

  await tx
    .update(channelCardkey)
    .set({
      status: ChannelCardkeyStatus.LOCKED,
      lockedByTaskId: taskId,
    })
    .where(eq(channelCardkey.id, row.id));

  return row;
}

/**
 * 释放渠道卡密（升级失败后放回池中）
 */
export async function releaseCardkey(cardkeyId: string) {
  await db()
    .update(channelCardkey)
    .set({
      status: ChannelCardkeyStatus.AVAILABLE,
      lockedByTaskId: null,
    })
    .where(eq(channelCardkey.id, cardkeyId));
}

/**
 * 标记渠道卡密为已使用
 */
export async function markCardkeyUsed(
  cardkeyId: string,
  attemptId: string
) {
  await db()
    .update(channelCardkey)
    .set({
      status: ChannelCardkeyStatus.USED,
      usedByAttemptId: attemptId,
      usedAt: new Date(),
    })
    .where(eq(channelCardkey.id, cardkeyId));
}

/**
 * 禁用渠道卡密（渠道拒绝/过期）
 */
export async function disableCardkey(cardkeyId: string, reason?: string) {
  await db()
    .update(channelCardkey)
    .set({
      status: ChannelCardkeyStatus.DISABLED,
      disabledReason: reason,
    })
    .where(eq(channelCardkey.id, cardkeyId));
}

// --- 批量操作 ---

/**
 * 批量删除（仅未使用的）
 */
export async function batchDeleteCardkeys(cardkeyIds: string[]) {
  await db()
    .delete(channelCardkey)
    .where(
      and(
        inArray(channelCardkey.id, cardkeyIds),
        inArray(channelCardkey.status, [
          ChannelCardkeyStatus.AVAILABLE,
          ChannelCardkeyStatus.DISABLED,
        ])
      )
    );
}
