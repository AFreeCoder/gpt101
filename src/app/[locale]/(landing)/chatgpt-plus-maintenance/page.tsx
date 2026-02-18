import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { MaintenancePage } from '@/themes/default/blocks/maintenance-page';

export const generateMetadata = getMetadata({
  title: 'GPT Plus 维护升级中',
  description: 'GPT Plus 服务维护升级中，请联系客服',
  noIndex: true,
});

export default async function ChatGPTPlusMaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MaintenancePage qqNumber="2316149029" qrCodePath="/qq-qrcode.png" />;
}
