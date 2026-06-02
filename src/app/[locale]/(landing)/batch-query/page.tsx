import { setRequestLocale } from 'next-intl/server';

import { BatchQueryClient } from './batch-query-client';

export const metadata = {
  title: '本站卡密批量查询 - GPT101',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BatchQueryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BatchQueryClient />;
}
