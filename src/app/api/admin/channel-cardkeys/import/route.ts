import { respData, respErr } from '@/shared/lib/resp';
import { requirePermission, PERMISSIONS } from '@/core/rbac';
import { importCardkeys } from '@/shared/models/channel-cardkey';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.CHANNEL_CARDKEY_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const { channelId, productCode, memberType, cardkeys } = await req.json();

    if (!channelId || !productCode || !memberType) {
      return respErr('缺少必填字段');
    }

    if (!cardkeys || !Array.isArray(cardkeys) || cardkeys.length === 0) {
      return respErr('请输入卡密');
    }

    const result = await importCardkeys({
      channelId,
      productCode,
      memberType,
      cardkeys,
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '导入失败');
  }
}
