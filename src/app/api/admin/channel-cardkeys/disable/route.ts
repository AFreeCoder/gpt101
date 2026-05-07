import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { batchDisableCardkeys } from '@/shared/models/channel-cardkey';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.CHANNEL_CARDKEY_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { ids, reason } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return respErr('请选择要禁用的卡密');
    }

    const result = await batchDisableCardkeys(
      ids,
      typeof reason === 'string' && reason.trim() ? reason.trim() : undefined
    );

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '禁用失败');
  }
}
