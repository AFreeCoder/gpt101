import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respErr } from '@/shared/lib/resp';
import { exportTaskListToCsv } from '@/shared/services/upgrade-task';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const csv = await exportTaskListToCsv({
      status: url.searchParams.get('status') || undefined,
      search: url.searchParams.get('search') || undefined,
      sourceType: url.searchParams.get('sourceType') || undefined,
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=upgrade-tasks-${Date.now()}.csv`,
      },
    });
  } catch (err: any) {
    return respErr(err.message || '导出失败');
  }
}
