// 去掉歧义字符 O/I/L/0/1
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// --- 产品和会员类型配置（后续可随时补充）---

export interface MemberType {
  code: string;
  label: string;
}

export interface ProductType {
  code: string;
  label: string;
  members: MemberType[];
}

export const PRODUCT_TYPES: ProductType[] = [
  {
    code: 'gpt',
    label: 'GPT',
    members: [
      { code: 'plus', label: 'Plus' },
      { code: 'pro100', label: 'Pro ($100)' },
      { code: 'pro200', label: 'Pro ($200)' },
    ],
  },
  {
    code: 'claude',
    label: 'Claude',
    members: [
      { code: 'pro', label: 'Pro' },
    ],
  },
  {
    code: 'gemini',
    label: 'Gemini',
    members: [
      { code: 'advanced', label: 'Advanced' },
    ],
  },
  {
    code: 'grok',
    label: 'Grok',
    members: [
      { code: 'premium', label: 'Premium' },
      { code: 'supergrok', label: 'SuperGrok' },
    ],
  },
];

/**
 * 获取所有产品代码列表
 */
export function getAllProductCodes(): string[] {
  return PRODUCT_TYPES.map((p) => p.code);
}

/**
 * 获取指定产品的会员类型列表
 */
export function getMemberTypes(productCode: string): MemberType[] {
  return PRODUCT_TYPES.find((p) => p.code === productCode)?.members || [];
}

/**
 * 获取产品+会员的显示名
 */
export function getProductMemberLabel(productCode: string, memberType: string): string {
  const product = PRODUCT_TYPES.find((p) => p.code === productCode);
  if (!product) return `${productCode}/${memberType}`;
  const member = product.members.find((m) => m.code === memberType);
  return `${product.label} ${member?.label || memberType}`;
}

// --- 卡密生成 ---

/**
 * 生成单个卡密
 * 格式：GPT101-XXXX-XXXX （统一前缀 + 8 位随机字符）
 */
export function generateRedeemCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `GPT101-${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * 校验卡密格式是否合法（不查库）
 */
export function validateRedeemCodeFormat(code: string): boolean {
  return /^GPT101-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/.test(
    code.toUpperCase()
  );
}
