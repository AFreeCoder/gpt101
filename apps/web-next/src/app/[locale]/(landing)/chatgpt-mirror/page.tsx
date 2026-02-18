import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { getMetadata } from '@/shared/lib/seo';
import { buildServiceJsonLd } from '@/shared/lib/jsonld';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  title: 'GPT 镜像服务 - 国内网络可用',
  description:
    'GPT 镜像服务 - 国内网络可用，支持GPT-5、GPTs商店、DALL-E 3画图等常见功能。天卡¥5起，月卡¥58。',
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Page locale={locale} page={page} />
    </>
  );
}
