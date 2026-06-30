import { redirect } from '@/core/i18n/navigation';

export const revalidate = 3600;

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/', locale });
}
