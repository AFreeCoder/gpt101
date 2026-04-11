import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { retryTask } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try { await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_WRITE }); } catch { return respErr('无权限'); }
  try {
    const { taskId } = await req.json();
    await retryTask(taskId);
    return respOk();
  } catch (err: any) { return respErr(err.message || '操作失败'); }
}
