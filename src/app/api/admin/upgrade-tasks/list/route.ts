import { sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { upgradeChannel, channelCardkey } from '@/config/db/schema';
import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { getTaskList } from '@/shared/services/upgrade-task';
import { parseUpgradeTaskMetadata } from '@/shared/services/upgrade-task-helpers';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const result = await getTaskList({
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 30,
      status: url.searchParams.get('status') || undefined,
      search: url.searchParams.get('search') || undefined,
    });

    // 关联查渠道名和渠道卡密
    const channelIds = [...new Set(result.items.map((t: any) => t.successChannelId).filter(Boolean))];
    const cardkeyIds = [...new Set(result.items.map((t: any) => t.successChannelCardkeyId).filter(Boolean))];

    const channelMap = new Map<string, string>();
    if (channelIds.length > 0) {
      const channels = await db()
        .select({ id: upgradeChannel.id, name: upgradeChannel.name })
        .from(upgradeChannel)
        .where(sql`${upgradeChannel.id} IN ${channelIds}`);
      channels.forEach((c: { id: string; name: string }) => channelMap.set(c.id, c.name));
    }

    const cardkeyMap = new Map<string, string>();
    if (cardkeyIds.length > 0) {
      const cardkeys = await db()
        .select({ id: channelCardkey.id, cardkey: channelCardkey.cardkey })
        .from(channelCardkey)
        .where(sql`${channelCardkey.id} IN ${cardkeyIds}`);
      cardkeys.forEach((c: { id: string; cardkey: string }) => cardkeyMap.set(c.id, c.cardkey));
    }

    const enriched = result.items.map((t: any) => {
      const metadata = parseUpgradeTaskMetadata(t.metadata);

      return {
        ...t,
        manualRequired: Boolean(metadata.manualRequired),
        successChannelName: t.successChannelId
          ? (channelMap.get(t.successChannelId) || metadata.manualSuccessChannelName || '')
          : (metadata.manualSuccessChannelName || ''),
        successChannelCardkey: t.successChannelCardkeyId
          ? (cardkeyMap.get(t.successChannelCardkeyId) || metadata.manualSuccessChannelCardkey || '')
          : (metadata.manualSuccessChannelCardkey || ''),
      };
    });

    return respData({ items: enriched, total: result.total });
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
