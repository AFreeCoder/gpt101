import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { markTaskSuccess } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try { await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_WRITE }); } catch { return respErr('无权限'); }
  try {
    const { taskId, note } = await req.json();
    await markTaskSuccess(taskId, note);
    return respOk();
  } catch (err: any) { return respErr(err.message || '操作失败'); }
}
