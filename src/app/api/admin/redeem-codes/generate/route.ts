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
    const { productCode, count, unitPrice, title } = body;

    if (!productCode) return respErr('请选择产品类型');
    if (!count || count < 1 || count > 1000) return respErr('数量须在 1~1000 之间');
    if (!unitPrice || unitPrice < 0) return respErr('请输入有效单价');
    if (!title || !title.trim()) return respErr('请输入批次名称');

    const result = await generateBatch({
      productCode,
      count: Number(count),
      unitPrice: Number(unitPrice),
      title: title.trim(),
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '生成失败');
  }
}
