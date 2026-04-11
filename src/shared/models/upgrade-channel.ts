import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { upgradeChannel, channelCardkey } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export type UpgradeChannel = typeof upgradeChannel.$inferSelect;

/**
 * 获取渠道列表，按 priority 升序排序
 */
export async function getChannelList() {
  return db()
    .select()
    .from(upgradeChannel)
    .orderBy(asc(upgradeChannel.priority));
}

/**
 * 根据 ID 获取单个渠道
 */
export async function getChannelById(id: string) {
  const [row] = await db()
    .select()
    .from(upgradeChannel)
    .where(eq(upgradeChannel.id, id))
    .limit(1);
  return row || null;
}

/**
 * 创建渠道
 */
export async function createChannel(data: {
  code: string;
  name: string;
  driver: string;
  supportedProducts: string;
  status: string;
  priority: number;
  requiresCardkey: boolean;
  note?: string;
}) {
  const id = getUuid();
  await db().insert(upgradeChannel).values({
    id,
    code: data.code,
    name: data.name,
    driver: data.driver,
    supportedProducts: data.supportedProducts,
    status: data.status,
    priority: data.priority,
    requiresCardkey: data.requiresCardkey,
    note: data.note || null,
  });
  return id;
}

/**
 * 更新渠道
 */
export async function updateChannel(
  id: string,
  data: Partial<{
    name: string;
    driver: string;
    supportedProducts: string;
    status: string;
    priority: number;
    requiresCardkey: boolean;
    note: string;
  }>
) {
  await db()
    .update(upgradeChannel)
    .set(data)
    .where(eq(upgradeChannel.id, id));
}

/**
 * 删除渠道（只允许删除没有关联卡密的渠道）
 */
export async function deleteChannel(id: string) {
  // 检查是否有关联的卡密
  const [{ total }] = await db()
    .select({ total: count() })
    .from(channelCardkey)
    .where(eq(channelCardkey.channelId, id));

  if (total > 0) {
    throw new Error('该渠道下还有卡密，无法删除');
  }

  await db().delete(upgradeChannel).where(eq(upgradeChannel.id, id));
}
