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

  return <MaintenancePage wechatId="AFreeCoder01" qrCodeUrl="https://tjjsjwhj-blog.oss-cn-beijing.aliyuncs.com/2026/03/05/17726209788829.jpg" />;
}
