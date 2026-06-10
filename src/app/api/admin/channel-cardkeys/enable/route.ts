import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { batchEnableCardkeys } from '@/shared/models/channel-cardkey';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.CHANNEL_CARDKEY_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return respErr('请选择要取消禁用的卡密');
    }

    const result = await batchEnableCardkeys(ids);

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '取消禁用失败');
  }
}
