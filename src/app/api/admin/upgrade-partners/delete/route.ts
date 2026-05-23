import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { deletePartnerApp } from '@/shared/services/partner-upgrade';

import { serializePartnerApp } from '../_shared';

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

    const app = await deletePartnerApp(body.id);
    return respData(serializePartnerApp(app));
  } catch (err: any) {
    return respErr(err.message || '删除失败');
  }
}
