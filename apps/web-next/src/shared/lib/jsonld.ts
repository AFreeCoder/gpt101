/**
 * JSON-LD 结构化数据生成工具
 * 用于在服务端页面组件中生成 schema.org 结构化数据
 */

/** 生成 FAQPage JSON-LD */
export function buildFaqJsonLd(items: Array<Record<string, any>>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const validItems = items.filter((item) => item.question && item.answer);
  if (!validItems.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: validItems.map((item) => ({
      '@type': 'Question',
      name: item.question!.replace(/^Q:\s*/, ''),
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/** 生成 WebSite JSON-LD */
export function buildWebsiteJsonLd(name: string, url: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
  };
}

/** 生成 Service JSON-LD */
export function buildServiceJsonLd(opts: {
  name: string;
  description: string;
  providerName: string;
  providerUrl: string;
  serviceType: string;
  areaServed?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    provider: {
      '@type': 'Organization',
      name: opts.providerName,
      url: opts.providerUrl,
    },
    areaServed: opts.areaServed || 'CN',
    serviceType: opts.serviceType,
  };
}
