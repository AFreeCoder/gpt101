import { respData, respErr } from '@/shared/lib/resp';
import { validateRedeemCodeFormat } from '@/shared/lib/redeem-code';
import { verifyRedeemCode } from '@/shared/services/upgrade-task';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) return respErr('请输入卡密');

    if (!validateRedeemCodeFormat(code)) {
      return respErr('卡密格式不正确');
    }

    const result = await verifyRedeemCode(code);
    if (!result.valid) {
      const messages: Record<string, string> = {
        not_found: '卡密不存在',
        disabled: '该卡密已被禁用',
        in_use: '该卡密正在使用中',
        already_used: '该卡密已被使用',
      };
      return respErr(messages[result.reason!] || '卡密无效');
    }

    return respData({ productCode: result.productCode });
  } catch (err: any) {
    return respErr(err.message || '验证失败');
  }
}
