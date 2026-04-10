import { desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { invoiceRequest } from '@/config/db/schema';
import { respData, respErr } from '@/shared/lib/resp';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    if (!email) return respErr('缺少邮箱参数');

    const [latest] = await db()
      .select({
        buyerType: invoiceRequest.buyerType,
        buyerName: invoiceRequest.buyerName,
        buyerTaxId: invoiceRequest.buyerTaxId,
        buyerAddress: invoiceRequest.buyerAddress,
        buyerPhone: invoiceRequest.buyerPhone,
        buyerBank: invoiceRequest.buyerBank,
        buyerBankAccount: invoiceRequest.buyerBankAccount,
        invoiceType: invoiceRequest.invoiceType,
      })
      .from(invoiceRequest)
      .where(eq(invoiceRequest.recipientEmail, email))
      .orderBy(desc(invoiceRequest.createdAt))
      .limit(1);

    return respData(latest || null);
  } catch (err: any) {
    return respErr(err.message || '查询失败');
  }
}
