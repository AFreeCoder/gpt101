import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { getMetadata } from '@/shared/lib/seo';
import { buildServiceJsonLd, buildFaqJsonLd } from '@/shared/lib/jsonld';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  title: 'GPT Plus 快速升级',
  description:
    'GPT Plus 代充快速升级：无需海外信用卡，微信/支付宝可用，通常 1-2 分钟完成充值。',
  canonicalUrl: '/lp/g/upgrade-chatgpt',
});

export default async function UpgradeChatGPTLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.lp-upgrade-chatgpt');

  const page: DynamicPage = t.raw('page');

  const Page = await getThemePage('dynamic-page');

  const appUrl = envConfigs.app_url;

  const jsonLdList = [
    buildServiceJsonLd({
      name: 'GPT Plus 快速升级',
      description:
        'GPT Plus 代充快速升级：无需海外信用卡，微信/支付宝可用，通常 1-2 分钟完成充值。',
      providerName: 'GPT101',
      providerUrl: appUrl,
      serviceType: 'GPT Plus 代充',
    }),
    buildFaqJsonLd(page.sections?.faq?.items || []),
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
      <Page locale={locale} page={page} />
    </>
  );
}
