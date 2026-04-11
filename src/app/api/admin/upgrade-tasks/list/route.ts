import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { getTaskList } from '@/shared/services/upgrade-task';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const result = await getTaskList({
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 30,
      status: url.searchParams.get('status') || undefined,
      search: url.searchParams.get('search') || undefined,
    });
    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
