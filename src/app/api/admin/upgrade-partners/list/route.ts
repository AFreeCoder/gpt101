import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { listPartnerApps } from '@/shared/services/partner-upgrade';

import { serializePartnerApp } from '../_shared';

export async function GET() {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_PARTNER_READ });
  } catch {
    return respErr('无权限');
  }

  try {
    const apps = await listPartnerApps();
    return respData(apps.map(serializePartnerApp));
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
