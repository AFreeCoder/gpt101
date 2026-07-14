export const CUSTOMER_SUPPORT_URL =
  'https://work.weixin.qq.com/ca/cawcde156287e5f967';

export const CUSTOMER_SUPPORT_QR_CODE_URL =
  'https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/article-publish-assistant/af54dc7e725beb4d7557d4d18a6141d881dac1d06aaed98d4d2825828ae89588.jpg';

export const CUSTOMER_SUPPORT_LABEL = '联系客服';
export const CUSTOMER_SUPPORT_LABEL_EN = 'Contact support';

const LEGACY_CUSTOMER_SUPPORT_PATTERNS_ZH = [
  /(?:联系客服微信|联系微信客服|联系微信|客服微信)\s*[：:]\s*AFreeCoder01/gi,
  /AFreeCoder01/g,
];

const LEGACY_CUSTOMER_SUPPORT_PATTERNS_EN = [
  /(?:Contact support WeChat|Contact WeChat support|Contact WeChat)\s*[：:]\s*AFreeCoder01/gi,
];

/**
 * 清理后台历史内容中的旧客服微信号，避免数据库配置覆盖新版入口后重新展示旧信息。
 */
export function replaceLegacyCustomerSupportText(value: string) {
  const englishNormalized = LEGACY_CUSTOMER_SUPPORT_PATTERNS_EN.reduce(
    (result, pattern) => result.replace(pattern, CUSTOMER_SUPPORT_LABEL_EN),
    value
  );

  return LEGACY_CUSTOMER_SUPPORT_PATTERNS_ZH.reduce(
    (result, pattern) => result.replace(pattern, CUSTOMER_SUPPORT_LABEL),
    englishNormalized
  );
}
