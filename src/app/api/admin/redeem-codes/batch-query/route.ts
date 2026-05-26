import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { queryRedeemCodeUsageBatch } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const codes = Array.isArray(body.codes)
      ? body.codes
      : typeof body.text === 'string'
        ? body.text
        : '';

    const result = await queryRedeemCodeUsageBatch(codes);
    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '最多查询 100 个卡密');
  }
}
