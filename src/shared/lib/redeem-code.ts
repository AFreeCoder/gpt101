// 去掉歧义字符 O/I/L/0/1
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * 生成单个卡密
 * 格式：PLS-XXXX-XXXX （产品前缀 + 8 位随机字符，分两组）
 */
export function generateRedeemCode(
  productPrefix: 'PLS' | 'PRO' | 'TEM'
): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `${productPrefix}-${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * 校验卡密格式是否合法（不查库）
 */
export function validateRedeemCodeFormat(code: string): boolean {
  return /^(PLS|PRO|TEM)-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(
    code.toUpperCase()
  );
}

/**
 * 从卡密中解析产品类型
 */
export function parseProductCode(
  code: string
): 'plus' | 'pro' | 'team' | null {
  const prefix = code.toUpperCase().slice(0, 3);
  switch (prefix) {
    case 'PLS':
      return 'plus';
    case 'PRO':
      return 'pro';
    case 'TEM':
      return 'team';
    default:
      return null;
  }
}

/**
 * 产品类型 → 卡密前缀
 */
export function productCodeToPrefix(
  productCode: string
): 'PLS' | 'PRO' | 'TEM' {
  switch (productCode) {
    case 'plus':
      return 'PLS';
    case 'pro':
      return 'PRO';
    case 'team':
      return 'TEM';
    default:
      return 'PLS';
  }
}
