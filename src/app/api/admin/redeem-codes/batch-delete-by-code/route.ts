import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { batchDeleteCodesByText } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_DELETE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { codes } = await req.json();
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return respErr('请粘贴要删除的卡密');
    }

    const result = await batchDeleteCodesByText(codes);
    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '批量删除失败');
  }
}
