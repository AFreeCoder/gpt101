import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respErr, respOk } from '@/shared/lib/resp';
import { batchEnable } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return respErr('请选择要取消禁用的卡密');
    }

    await batchEnable(ids);
    return respOk();
  } catch (err: any) {
    return respErr(err.message || '取消禁用失败');
  }
}
