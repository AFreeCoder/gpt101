import { redirect } from 'next/navigation';

export default function GptUpgradeXiaobeiPage() {
  redirect('/upgrade?source=legacy-xiaobei');
}
