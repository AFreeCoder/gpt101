import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { UpgradeChannel } from '@/themes/default/blocks/upgrade-channel';

export const generateMetadata = getMetadata({
  title: 'GPT Plus 充值 - 推荐渠道',
  description: '通过内嵌页面完成 GPT Plus 充值',
  noIndex: true,
});

export default async function GptUpgrade987aiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <UpgradeChannel
      embedUrl="https://www.987ai.vip/recharge"
      title="GPT Plus 充值通道 987ai"
    />
  );
}
