import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getMetadata } from '@/shared/lib/seo';
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

  return <Page locale={locale} page={page} />;
}
