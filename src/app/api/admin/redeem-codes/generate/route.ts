import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { validateRedeemCodePrefix } from '@/shared/lib/redeem-code';
import { respData, respErr } from '@/shared/lib/resp';
import { generateBatch } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const { productCode, memberType, count, unitPrice, prefix } = body;

    if (!productCode) return respErr('请选择产品类型');
    if (!memberType) return respErr('请选择会员类型');
    if (!count || count < 1 || count > 5000)
      return respErr('数量须在 1~5000 之间');
    if (!unitPrice) return respErr('请输入单价');
    if (prefix && !validateRedeemCodePrefix(String(prefix))) {
      return respErr('卡密前缀只能包含 2-20 位字母或数字');
    }

    const result = await generateBatch({
      productCode,
      memberType,
      count: Number(count),
      unitPrice: String(unitPrice),
      prefix: prefix ? String(prefix) : undefined,
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '生成失败');
  }
}
