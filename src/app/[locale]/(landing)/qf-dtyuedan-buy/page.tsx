import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { UpgradeChannel } from '@/themes/default/blocks/upgrade-channel';

export const generateMetadata = getMetadata({
  title: '快捷购买 - 卡密充值通道',
  description: '站内直达卡密购买页面',
  noIndex: true,
});

export default async function QfDtyuedanBuyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <UpgradeChannel
      embedUrl="https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj"
      title="卡密购买通道"
    />
  );
}
