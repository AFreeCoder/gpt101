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

const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_BODY_LENGTH = 32;

/**
 * 生成单个卡密
 * 格式：GPT101-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX（前缀 + 32 位大写字母+数字）
 */
export function generateRedeemCode(): string {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    body += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return `GPT101-${body}`;
}

/**
 * 校验卡密格式是否合法（不查库）
 */
export function validateRedeemCodeFormat(code: string): boolean {
  return /^GPT101-[A-Z0-9]{32}$/.test(code.toUpperCase());
}

// --- 状态显示 ---

export const STATUS_LABELS: Record<string, string> = {
  available: '可用',
  consumed: '已使用',
  disabled: '已禁用',
};

export const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-600 bg-green-50',
  consumed: 'text-gray-500 bg-gray-100',
  disabled: 'text-red-600 bg-red-50',
};
