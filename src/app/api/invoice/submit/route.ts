import { db } from '@/core/db';
import { invoiceRequest } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr, respOk } from '@/shared/lib/resp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      buyerType,
      buyerName,
      buyerTaxId,
      buyerAddress,
      buyerPhone,
      buyerBank,
      buyerBankAccount,
      invoiceType,
      invoiceItem,
      invoiceAmount,
      recipientEmail,
    } = body;

    if (!recipientEmail) return respErr('请输入接收发票的邮箱');
    if (!buyerName) return respErr('请输入发票抬头');

    await db().insert(invoiceRequest).values({
      id: getUuid(),
      status: 'submitted',
      buyerType,
      buyerName,
      buyerTaxId,
      buyerAddress,
      buyerPhone,
      buyerBank,
      buyerBankAccount,
      invoiceType,
      invoiceItem,
      invoiceAmount: invoiceAmount ? Math.round(invoiceAmount * 100) : undefined,
      recipientEmail,
      submittedAt: new Date(),
    });

    return respOk();
  } catch (err: any) {
    return respErr(err.message || '提交失败');
  }
}
