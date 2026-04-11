import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { respErr } from '@/shared/lib/resp';
import { exportCodesToCsv } from '@/shared/models/redeem-code';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const csv = await exportCodesToCsv({
      batchId: url.searchParams.get('batchId') || undefined,
      productCode: url.searchParams.get('productCode') || undefined,
      memberType: url.searchParams.get('memberType') || undefined,
      status: url.searchParams.get('status') || undefined,
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=redeem-codes-${Date.now()}.csv`,
      },
    });
  } catch (err: any) {
    return respErr(err.message || '导出失败');
  }
}
