import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { getChannelList } from '@/shared/models/upgrade-channel';
import { getAvailableCount } from '@/shared/models/channel-cardkey';

export async function GET() {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_CHANNEL_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const channels = await getChannelList();

    const channelsWithStock = await Promise.all(
      channels.map(async (channel: (typeof channels)[number]) => {
        const availableCount = await getAvailableCount(channel.id);
        return { ...channel, availableCount };
      })
    );

    return respData(channelsWithStock);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
