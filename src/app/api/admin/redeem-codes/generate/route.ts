import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { generateBatch } from '@/shared/models/redeem-code';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.REDEEM_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const { productCode, memberType, count, unitPrice, title } = body;

    if (!productCode) return respErr('请选择产品类型');
    if (!memberType) return respErr('请选择会员类型');
    if (!count || count < 1 || count > 5000) return respErr('数量须在 1~5000 之间');
    if (!unitPrice) return respErr('请输入单价');
    if (!title || !title.trim()) return respErr('请输入批次名称');

    const result = await generateBatch({
      productCode,
      memberType,
      count: Number(count),
      unitPrice: String(unitPrice),
      title: title.trim(),
    });

    return respData(result);
  } catch (err: any) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return respErr('批次名称已存在');
    }
    return respErr(err.message || '生成失败');
  }
}
