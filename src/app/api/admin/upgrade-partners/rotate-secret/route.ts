import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { rotatePartnerAppSecret } from '@/shared/services/partner-upgrade';

import { serializePartnerApp } from '../_shared';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_CHANNEL_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    if (!body.id || typeof body.id !== 'string') {
      return respErr('缺少接入方 ID');
    }

    const result = await rotatePartnerAppSecret(body.id);
    return respData({
      app: serializePartnerApp(result.app),
      appSecret: result.appSecret,
    });
  } catch (err: any) {
    return respErr(err.message || '轮换失败');
  }
}
