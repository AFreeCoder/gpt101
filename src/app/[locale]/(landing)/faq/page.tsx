import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemeBlock } from '@/core/theme';
import { envConfigs } from '@/config';
import {
  getContentConfigValue,
  HOMEPAGE_FAQ_CONFIG_KEY,
  resolveFaqConfig,
} from '@/shared/lib/content-config';
import {
  buildFaqJsonLd,
  buildServiceJsonLd,
  buildWebsiteJsonLd,
} from '@/shared/lib/jsonld';
import { getContentConfigValues } from '@/shared/models/content-config';
import type { DynamicPage, FAQ } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

function getFaqPageCopy(locale: string) {
  const isZh = locale === 'zh';

  return {
    title: isZh ? '有什么可以帮到你？' : 'How can we help?',
    description: isZh
      ? '整理了购买、升级、使用、开票和售后的常见问题。'
      : 'Browse common questions about purchase, upgrade, usage, invoices, and support.',
    metadataTitle: isZh ? 'GPT101 常见问题 FAQ' : 'GPT101 FAQ and Help Center',
    metadataDescription: isZh
      ? 'GPT101 常见问题，覆盖购买、升级、账号使用、开票和售后支持。'
      : 'GPT101 FAQ covering purchase, upgrade, account usage, invoices, and support.',
  };
}

function getCanonicalUrl(locale: string) {
  const path = locale !== envConfigs.locale ? `/${locale}/faq` : '/faq';
  return `${envConfigs.app_url}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getFaqPageCopy(locale);

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: getCanonicalUrl(locale),
    },
  };
}

export default async function FaqRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const copy = getFaqPageCopy(locale);
  const t = await getTranslations('pages.index');
  const homePage: DynamicPage = t.raw('page');
  const contentConfigs = await getContentConfigValues();
  const resolvedFaq = resolveFaqConfig(
    getContentConfigValue(contentConfigs, HOMEPAGE_FAQ_CONFIG_KEY, locale),
    (homePage.sections?.faq || {
      id: 'faq',
      block: 'faq',
      title: copy.title,
      description: copy.description,
      items: [],
    }) as FAQ
  );
  const pageFaq: FAQ = {
    ...resolvedFaq,
    title: copy.title,
    description: copy.description,
  };

  const FaqPage = await getThemeBlock('faq-page');
  const appUrl = envConfigs.app_url;
  const jsonLdList = [
    buildWebsiteJsonLd('GPT101', appUrl, copy.metadataDescription),
    buildServiceJsonLd({
      name: 'GPT101',
      description: copy.metadataDescription,
      providerName: 'GPT101',
      providerUrl: appUrl,
      serviceType:
        locale === 'zh' ? 'GPT 充值与售后支持' : 'GPT subscription support',
    }),
    buildFaqJsonLd(resolvedFaq.items || []),
  ].filter(Boolean);

  return (
    <>
      {jsonLdList.map((jsonLd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      <FaqPage faq={pageFaq} locale={locale} />
    </>
  );
}
