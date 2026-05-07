import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respErr, respOk } from '@/shared/lib/resp';
import { rebindTaskChannelCardkey } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { taskId, channelId, channelCardkey, note } = await req.json();
    await rebindTaskChannelCardkey(taskId, {
      channelId,
      channelCardkey,
      note,
    });
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '操作失败');
  }
}
