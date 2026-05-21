import { UpgradeFlow } from '@/shared/blocks/upgrade/upgrade-flow';
import {
  getContentConfigValue,
  resolveUpgradeNoticeConfig,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '@/shared/lib/content-config';
import { getContentConfigValues } from '@/shared/models/content-config';

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
