import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { getCardkeyList } from '@/shared/models/channel-cardkey';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.CHANNEL_CARDKEY_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return respErr('缺少 channelId');
    }

    const result = await getCardkeyList({
      channelId,
      productCode: url.searchParams.get('productCode') || undefined,
      memberType: url.searchParams.get('memberType') || undefined,
      status: url.searchParams.get('status') || undefined,
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 20,
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
