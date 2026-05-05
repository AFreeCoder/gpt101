import { redirect } from 'next/navigation';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AgentUpgradeStatusPage({
  params,
}: {
  params: Promise<{ taskNo: string }>;
}) {
  const { taskNo } = await params;
  redirect(`/upgrade/status/${taskNo}`);
}
