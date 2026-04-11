import { respOk, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { batchDisable, disableCode } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { ids, reason } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return respErr('请选择要禁用的卡密');
    }

    await batchDisable(ids, reason || '管理员禁用');
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '禁用失败');
  }
}
