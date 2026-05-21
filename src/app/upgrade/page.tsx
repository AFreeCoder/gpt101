import { UpgradeFlow } from '@/shared/blocks/upgrade/upgrade-flow';
import {
  getContentConfigValue,
  resolveUpgradeNoticeConfig,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '@/shared/lib/content-config';
import { getContentConfigValues } from '@/shared/models/content-config';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function UpgradeSubdomainPage() {
  const contentConfigs = await getContentConfigValues();
  const noticeConfig = resolveUpgradeNoticeConfig(
    getContentConfigValue(contentConfigs, UPGRADE_NOTICE_CONFIG_KEY, 'zh')
  );

  return (
    <UpgradeFlow
      showSupportCard={false}
      supportContact={null}
      noticeConfig={noticeConfig}
      submitErrorMessage="升级异常，请联系购卡渠道处理"
      failedHelpText="升级异常，请联系购卡渠道处理，并提供任务编号。"
      safetyIssueText="异常请联系购卡渠道处理"
    />
  );
}
