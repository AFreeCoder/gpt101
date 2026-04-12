import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { retryTask, pickAndRunTasks } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try { await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_WRITE }); } catch { return respErr('无权限'); }
  try {
    const { taskId } = await req.json();
    await retryTask(taskId);

    // 重试后立即触发 Worker 处理
    pickAndRunTasks(1).catch((err) => console.error('[retry] worker error:', err));

    return respOk();
  } catch (err: any) { return respErr(err.message || '操作失败'); }
}
