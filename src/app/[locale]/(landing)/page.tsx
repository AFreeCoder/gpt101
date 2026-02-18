import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import {
  buildWebsiteJsonLd,
  buildServiceJsonLd,
  buildFaqJsonLd,
} from '@/shared/lib/jsonld';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');

  // get page data
  const page: DynamicPage = t.raw('page');

  // load page component
  const Page = await getThemePage('dynamic-page');

  const appUrl = envConfigs.app_url;

  const jsonLdList = [
    buildWebsiteJsonLd(
      'GPT101',
      appUrl,
      'GPT Plus 代充和 GPT 镜像服务，Plus / Pro / Team 全支持，微信支付宝通常1-2分钟到账，无需信用卡。'
    ),
    buildServiceJsonLd({
      name: 'GPT Plus 代充服务',
      description:
        '一站式 GPT 充值服务，Plus / Pro / Team 全支持，微信支付宝通常1-2分钟到账，无需信用卡。',
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
