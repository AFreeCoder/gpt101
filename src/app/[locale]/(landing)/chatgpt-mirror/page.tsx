import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import {
  getContentConfigValue,
  MIRROR_FAQ_CONFIG_KEY,
  resolveFaqConfig,
} from '@/shared/lib/content-config';
import { buildFaqJsonLd, buildServiceJsonLd } from '@/shared/lib/jsonld';
import { getMetadata } from '@/shared/lib/seo';
import { getContentConfigValues } from '@/shared/models/content-config';
import { DynamicPage, FAQ } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.chatgpt-mirror.metadata',
  canonicalUrl: '/chatgpt-mirror',
});

export default async function ChatGPTMirrorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.chatgpt-mirror');

  const page: DynamicPage = t.raw('page');
  const contentConfigs = await getContentConfigValues();
  const resolvedFaq = resolveFaqConfig(
    getContentConfigValue(contentConfigs, MIRROR_FAQ_CONFIG_KEY, locale),
    (page.sections?.faq || {
      id: 'faqs',
      block: 'faq',
      title: 'FAQ',
      items: [],
    }) as FAQ
  );
  page.sections = {
    ...page.sections,
    faq: resolvedFaq,
  };

  const Page = await getThemePage('dynamic-page');

  const appUrl = envConfigs.app_url;

  const serviceJsonLd = buildServiceJsonLd({
    name: 'GPT 镜像服务',
    description:
      'GPT 镜像服务 - 国内网络可用，支持GPT-5、GPTs商店、DALL-E 3画图等常见功能。天卡¥5起，月卡¥58。',
    providerName: 'GPT101',
    providerUrl: appUrl,
    serviceType: 'GPT 镜像',
  });
  const faqJsonLd = buildFaqJsonLd(resolvedFaq.items || []);

  return (
    <>
      {[serviceJsonLd, faqJsonLd].filter(Boolean).map((jsonLd, i) => (
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
