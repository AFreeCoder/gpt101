import { respData, respErr } from '@/shared/lib/resp';
import {
  readAuthenticatedPartnerJson,
  submitPartnerUpgradeTask,
} from '@/shared/services/partner-upgrade';
import { pickAndRunTasks } from '@/shared/services/upgrade-task';
import { queueUpgradeTaskProcessing } from '@/shared/services/upgrade-worker-trigger';

export async function POST(req: Request) {
  try {
    const { app, body } = await readAuthenticatedPartnerJson(req);
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '';
    const userAgent = req.headers.get('user-agent') || '';
    const result = await submitPartnerUpgradeTask({
      app,
      externalOrderNo: body.externalOrderNo,
      sessionToken: body.sessionToken,
      chatgptEmail: body.chatgptEmail,
      chatgptAccountId: body.chatgptAccountId,
      chatgptCurrentPlan: body.chatgptCurrentPlan,
      clientIp,
      userAgent,
    });

    queueUpgradeTaskProcessing(1, pickAndRunTasks);

    return respData({ taskNo: result.taskNo });
  } catch (err: any) {
    return respErr(err.message || '提交失败');
  }
}
