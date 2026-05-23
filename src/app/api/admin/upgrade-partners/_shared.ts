import {
  parsePartnerAllowedProducts,
  type UpgradePartnerApp,
} from '@/shared/services/partner-upgrade';

export function serializePartnerApp(app: UpgradePartnerApp) {
  return {
    id: app.id,
    appKey: app.appKey,
    name: app.name,
    status: app.status,
    allowedProducts: parsePartnerAllowedProducts(app.allowedProducts),
    ipAllowlist:
      app.ipAllowlist
        ?.split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean) || [],
    rateLimitPerMinute: app.rateLimitPerMinute,
    note: app.note,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function parseAllowedProducts(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const product = item as {
        productCode?: unknown;
        memberType?: unknown;
      };

      const productCode =
        typeof product.productCode === 'string'
          ? product.productCode.trim()
          : '';
      const memberType =
        typeof product.memberType === 'string' ? product.memberType.trim() : '';

      if (!productCode) return null;
      return {
        productCode,
        ...(memberType ? { memberType } : {}),
      };
    })
    .filter(Boolean) as Array<{ productCode: string; memberType?: string }>;
}
