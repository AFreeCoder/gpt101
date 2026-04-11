import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { batchDeleteCardkeys } from '@/shared/models/channel-cardkey';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.CHANNEL_CARDKEY_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return respErr('请选择要删除的卡密');
    }

    await batchDeleteCardkeys(ids);
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '删除失败');
  }
}
