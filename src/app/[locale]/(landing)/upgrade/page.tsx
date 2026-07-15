import { UpgradeFlow } from '@/shared/blocks/upgrade/upgrade-flow';
import {
  getContentConfigValue,
  resolveUpgradeNoticeConfig,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '@/shared/lib/content-config';
import { getMetadata } from '@/shared/lib/seo';
import { getContentConfigValues } from '@/shared/models/content-config';

export const generateMetadata = getMetadata({
  title: 'GPT Plus 自助升级 - GPT101',
  description: '使用已购买的卡密完成 GPT Plus 自助升级。',
  noIndex: true,
});

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const contentConfigs = await getContentConfigValues();
  const noticeConfig = resolveUpgradeNoticeConfig(
    getContentConfigValue(contentConfigs, UPGRADE_NOTICE_CONFIG_KEY, locale)
  );

  return <UpgradeFlow noticeConfig={noticeConfig} />;
}
