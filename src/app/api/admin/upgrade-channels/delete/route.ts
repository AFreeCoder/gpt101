import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { deleteChannel } from '@/shared/models/upgrade-channel';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_CHANNEL_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return respErr('缺少渠道 ID');
    }

    await deleteChannel(id);
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '删除失败');
  }
}
