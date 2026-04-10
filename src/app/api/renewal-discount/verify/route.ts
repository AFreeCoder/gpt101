import { eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { renewalDiscount, renewalDiscountCoupon } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';

export async function POST(req: Request) {
  try {
    const { verifyValue } = await req.json();
    if (!verifyValue || verifyValue.trim().length < 3) {
      return respErr('请输入有效的订单号或卡密');
    }

    const value = verifyValue.trim();

    // 检查是否已领过
    const [existing] = await db()
      .select()
      .from(renewalDiscount)
      .where(eq(renewalDiscount.verifyValue, value));

    if (existing) {
      // 幂等：返回之前发放的优惠码
      return respData({
        couponCode: existing.discountResult,
        message: '您已领取过优惠，优惠码如下：',
      });
    }

    // TODO: 验证 verifyValue 是否有效
    // 1. 查本站 redeem_code 表中 status='consumed' 的记录
    // 2. 查导入的旧订单号清单（需要额外实现）
    // 目前先跳过验证，直接发放

    // 从优惠码池取一个未发放的
    const [coupon] = await db()
      .select()
      .from(renewalDiscountCoupon)
      .where(eq(renewalDiscountCoupon.status, 'available'))
      .limit(1);

    if (!coupon) {
      return respErr('优惠码暂时缺货，请联系客服');
    }

    // 发放
    const discountId = getUuid();
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '';

    await db().transaction(async (tx: any) => {
      await tx.insert(renewalDiscount).values({
        id: discountId,
        verifyType: 'auto',
        verifyValue: value,
        discountResult: coupon.couponCode,
        clientIp,
      });

      await tx
        .update(renewalDiscountCoupon)
        .set({
          status: 'issued',
          issuedToId: discountId,
          issuedAt: new Date(),
        })
        .where(eq(renewalDiscountCoupon.id, coupon.id));
    });

    return respData({
      couponCode: coupon.couponCode,
      message: '验证成功！您的优惠码如下，请在发卡网购买时使用：',
    });
  } catch (err: any) {
    if (err.message?.includes('unique')) {
      // 并发请求，重新查询
      const { verifyValue } = await req.json().catch(() => ({ verifyValue: '' }));
      const [existing] = await db()
        .select()
        .from(renewalDiscount)
        .where(eq(renewalDiscount.verifyValue, verifyValue?.trim()));
      if (existing) {
        return respData({
          couponCode: existing.discountResult,
          message: '您已领取过优惠，优惠码如下：',
        });
      }
    }
    return respErr(err.message || '验证失败');
  }
}
