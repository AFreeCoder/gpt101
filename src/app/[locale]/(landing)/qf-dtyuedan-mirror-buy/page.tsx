import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { UpgradeChannel } from '@/themes/default/blocks/upgrade-channel';

export const generateMetadata = getMetadata({
  title: '镜像服务购买 - 快捷通道',
  description: '站内直达镜像服务购买页面',
  noIndex: true,
});

export default async function QfDtyuedanMirrorBuyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <UpgradeChannel
      embedUrl="https://fe.dtyuedan.cn/shop/F2OLER91/3fptbk"
      title="镜像服务购买通道"
    />
  );
}
