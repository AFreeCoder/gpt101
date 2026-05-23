import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { updatePartnerApp } from '@/shared/services/partner-upgrade';

import {
  parseAllowedProducts,
  parseStringList,
  serializePartnerApp,
} from '../_shared';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_PARTNER_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    if (!body.id || typeof body.id !== 'string') {
      return respErr('缺少接入方 ID');
    }

    const allowedProducts = parseAllowedProducts(body.allowedProducts);
    if (allowedProducts.length === 0) {
      return respErr('请选择允许售卖的商品');
    }

    const app = await updatePartnerApp(body.id, {
      name: body.name,
      status: body.status,
      allowedProducts,
      ipAllowlist: parseStringList(body.ipAllowlist),
      rateLimitPerMinute: Number(body.rateLimitPerMinute) || 120,
      note: typeof body.note === 'string' ? body.note : undefined,
    });

    return respData(serializePartnerApp(app));
  } catch (err: any) {
    return respErr(err.message || '更新失败');
  }
}
