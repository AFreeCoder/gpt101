import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { getCodeList } from '@/shared/models/redeem-code';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const result = await getCodeList({
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 30,
      status: url.searchParams.get('status') || undefined,
      productCode: url.searchParams.get('productCode') || undefined,
      memberType: url.searchParams.get('memberType') || undefined,
      batchId: url.searchParams.get('batchId') || undefined,
      search: url.searchParams.get('search') || undefined,
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
