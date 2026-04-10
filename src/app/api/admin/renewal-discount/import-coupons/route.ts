import { eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { renewalDiscountCoupon } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';

export async function POST(req: Request) {
  try {
    const { coupons } = await req.json();
    if (!coupons || !Array.isArray(coupons) || coupons.length === 0) {
      return respErr('请提供优惠码列表');
    }

    let importedCount = 0;
    let skippedCount = 0;

    await db().transaction(async (tx: any) => {
      for (const code of coupons) {
        const trimmed = code.trim();
        if (!trimmed) {
          skippedCount++;
          continue;
        }
        try {
          await tx.insert(renewalDiscountCoupon).values({
            id: getUuid(),
            couponCode: trimmed,
            status: 'available',
          });
          importedCount++;
        } catch {
          skippedCount++;
        }
      }
    });

    return respData({ importedCount, skippedCount });
  } catch (err: any) {
    return respErr(err.message || '导入失败');
  }
}
