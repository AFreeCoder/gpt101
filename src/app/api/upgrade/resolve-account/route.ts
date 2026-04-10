import { respData, respErr } from '@/shared/lib/resp';
import { resolveAccount } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try {
    const { sessionToken } = await req.json();
    if (!sessionToken) return respErr('请输入 session token');

    const account = await resolveAccount(sessionToken);

    return respData({
      email: account.email,
      accountId: account.accountId,
      currentPlan: account.currentPlan,
    });
  } catch (err: any) {
    return respErr(err.message || '解析账号失败');
  }
}
