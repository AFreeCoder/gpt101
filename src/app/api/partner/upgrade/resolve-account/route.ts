import { respData, respErr } from '@/shared/lib/resp';
import {
  readAuthenticatedPartnerJson,
  resolvePartnerAccount,
} from '@/shared/services/partner-upgrade';

export async function POST(req: Request) {
  try {
    const { app, body } = await readAuthenticatedPartnerJson(req);
    const account = await resolvePartnerAccount({
      app,
      externalOrderNo: body.externalOrderNo,
      sessionToken: body.sessionToken,
    });

    return respData(account);
  } catch (err: any) {
    return respErr(err.message || '解析账号失败');
  }
}
