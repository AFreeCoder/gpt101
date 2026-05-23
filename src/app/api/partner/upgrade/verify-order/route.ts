import { respData, respErr } from '@/shared/lib/resp';
import {
  readAuthenticatedPartnerJson,
  verifyPartnerOrder,
} from '@/shared/services/partner-upgrade';

export async function POST(req: Request) {
  try {
    const { app, body } = await readAuthenticatedPartnerJson(req);
    const result = await verifyPartnerOrder({
      app,
      externalOrderNo: body.externalOrderNo,
      productCode: body.productCode,
      memberType: body.memberType,
    });

    return respData({
      valid: true,
      externalOrderNo: result.externalOrderNo,
      productCode: result.productCode,
      memberType: result.memberType,
    });
  } catch (err: any) {
    return respErr(err.message || '外部订单核验失败');
  }
}
