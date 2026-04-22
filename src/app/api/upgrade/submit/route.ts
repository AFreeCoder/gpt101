import { respData, respErr } from '@/shared/lib/resp';
import { validateRedeemCodeFormat } from '@/shared/lib/redeem-code';
import { pickAndRunTasks } from '@/shared/services/upgrade-task';
import { submitUpgradeTask } from '@/shared/services/upgrade-task';
import { queueUpgradeTaskProcessing } from '@/shared/services/upgrade-worker-trigger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, sessionToken, chatgptEmail, chatgptAccountId, chatgptCurrentPlan, source, utm_source, utm_medium, utm_campaign } = body;

    if (!code) return respErr('请输入卡密');
    if (!sessionToken) return respErr('请输入 session token');

    if (!validateRedeemCodeFormat(code)) {
      return respErr('卡密格式不正确');
    }

    // 获取客户端信息
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '';
    const userAgent = req.headers.get('user-agent') || '';

    const metadata: Record<string, string> = {};
    if (source) metadata.source = source;
    if (utm_source) metadata.utm_source = utm_source;
    if (utm_medium) metadata.utm_medium = utm_medium;
    if (utm_campaign) metadata.utm_campaign = utm_campaign;

    const result = await submitUpgradeTask({
      code,
      sessionToken,
      chatgptEmail,
      chatgptAccountId,
      chatgptCurrentPlan,
      clientIp,
      userAgent,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    queueUpgradeTaskProcessing(1, pickAndRunTasks);

    return respData({ taskNo: result.taskNo });
  } catch (err: any) {
    return respErr(err.message || '提交失败');
  }
}
