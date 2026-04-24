import { UpgradeFlow } from '@/shared/blocks/upgrade/upgrade-flow';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AgentUpgradePage() {
  return (
    <UpgradeFlow
      showSupportCard={false}
      supportContact={null}
      submitErrorMessage="升级异常，请联系购卡渠道处理"
      failedHelpText="升级异常，请联系购卡渠道处理，并提供任务编号。"
      safetyIssueText="异常请联系购卡渠道处理"
    />
  );
}
