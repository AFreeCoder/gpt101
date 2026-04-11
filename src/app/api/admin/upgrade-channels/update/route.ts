import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { updateChannel } from '@/shared/models/upgrade-channel';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_CHANNEL_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return respErr('缺少渠道 ID');
    }

    await updateChannel(id, fields);
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '更新失败');
  }
}
