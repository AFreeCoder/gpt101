import { UpgradeStatusView } from '@/shared/blocks/upgrade/upgrade-status-view';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChannelUpgradeStatusPage() {
  return (
    <div className="channel-skin channel-tokens">
      <UpgradeStatusView
        variant="channel"
        supportContact={null}
        failedHelpText="请联系购卡渠道处理，并提供任务编号："
      />
    </div>
  );
}
