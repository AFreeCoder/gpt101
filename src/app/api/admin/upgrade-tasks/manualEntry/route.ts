import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { createManualUpgradeTask } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try {
    await requirePermission({ code: PERMISSIONS.UPGRADE_TASK_WRITE });
  } catch {
    return respErr('无权限');
  }

  try {
    const {
      redeemCode,
      sessionToken,
      chatgptEmail,
      channelId,
      channelCardkey,
      note,
    } = await req.json();
    const result = await createManualUpgradeTask({
      redeemCode,
      sessionToken,
      chatgptEmail,
      channelId,
      channelCardkey,
      note,
    });

    return respData(result);
  } catch (err: any) {
    return respErr(err.message || '补录失败');
  }
}
