import { UpgradeStatusView } from '@/shared/blocks/upgrade/upgrade-status-view';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AgentUpgradeStatusPage() {
  return (
    <UpgradeStatusView
      supportContact={null}
      failedHelpText="请联系购卡渠道处理，并提供任务编号："
    />
  );
}
