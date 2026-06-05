import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';

import { QueryClient } from './query-client';

function getCopy(locale: string) {
  const isZh = locale === 'zh';

  return {
    title: isZh ? '卡密状态查询 - GPT101' : 'Card status query - GPT101',
    description: isZh
      ? '输入单个 GPT101 卡密，查询卡密是否可用，以及已提交升级任务的处理状态。'
      : 'Enter one GPT101 card code to check availability and submitted upgrade status.',
  };
}

function getCanonicalUrl(locale: string) {
  const path = locale !== envConfigs.locale ? `/${locale}/query` : '/query';
  return `${envConfigs.app_url}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = getCopy(locale);

  return {
    title: copy.title,
    description: copy.description,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: getCanonicalUrl(locale),
    },
  };
}

export default async function QueryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <QueryClient locale={locale} />;
}
