import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listPartnerApps } from '@/shared/services/partner-upgrade';

import { serializePartnerApp } from '../_shared';

export async function GET(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_PARTNER_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const url = new URL(req.url);
    const result = await listPartnerApps({
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 30,
      search: url.searchParams.get('search') || undefined,
      status: url.searchParams.get('status') || undefined,
    });

    return respData({
      items: result.items.map(serializePartnerApp),
      total: result.total,
    });
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
