import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { createChannel } from '@/shared/models/upgrade-channel';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_CHANNEL_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const { code, name, driver, supportedProducts, status, priority, requiresCardkey, note } = body;

    if (!code || !name || !driver || !supportedProducts || !status) {
      return respErr('缺少必填字段');
    }

    const id = await createChannel({
      code,
      name,
      driver,
      supportedProducts,
      status,
      priority: priority ?? 100,
      requiresCardkey: requiresCardkey ?? false,
      note,
    });

    return respData({ id });
  } catch (err: any) {
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return respErr('渠道代码已存在');
    }
    return respErr(err.message || '创建失败');
  }
}
