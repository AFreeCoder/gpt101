import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { batchDisableCodesByText } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { codes, reason } = await req.json();
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return respErr('请粘贴要禁用的卡密');
    }

    const result = await batchDisableCodesByText(
      codes,
      reason || '管理员按卡密批量禁用'
    );
    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '批量禁用失败');
  }
}
