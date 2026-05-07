import { validateRedeemCodeFormat } from '@/shared/lib/redeem-code';
import { respData, respErr } from '@/shared/lib/resp';
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
      if (result.task) {
        return respData(result);
      }

      const messages: Record<string, string> = {
        not_found: '卡密不存在',
        disabled: '该卡密已被禁用',
        already_used: '该卡密已被使用',
        already_succeeded: '该卡密已被使用',
        processing: '该卡密已有升级任务处理中',
        manual_required: '该卡密已提交升级，当前充值异常待客服处理',
        occupied: '该卡密已提交升级，请联系客服处理',
      };
      return respErr(messages[result.reason!] || '卡密无效');
    }

    return respData({
      valid: true,
      productCode: result.productCode,
      memberType: result.memberType,
    });
  } catch (err: any) {
    return respErr(err.message || '验证失败');
  }
}
