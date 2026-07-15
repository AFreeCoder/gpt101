import { UpgradeStatusView } from '@/shared/blocks/upgrade/upgrade-status-view';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function UpgradeStatusPage() {
  return <UpgradeStatusView />;
}
