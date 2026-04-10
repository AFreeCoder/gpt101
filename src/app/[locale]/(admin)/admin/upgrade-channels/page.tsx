import { asc } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { upgradeChannel } from '@/config/db/schema';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getAvailableCount } from '@/shared/models/channel-cardkey';
import { Crumb } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function UpgradeChannelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.UPGRADE_CHANNEL_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '升级渠道', is_active: true },
  ];

  const channels = await db()
    .select()
    .from(upgradeChannel)
    .orderBy(asc(upgradeChannel.priority));

  // 查询每个渠道的可用库存数量
  type UpgradeChannel = typeof channels[number];

  const channelsWithStock = await Promise.all(
    channels.map(async (channel: UpgradeChannel) => {
      const availableCount = await getAvailableCount(channel.id);
      return { ...channel, availableCount };
    })
  );

  const table: Table = {
    columns: [
      { name: 'code', title: '渠道代码', type: 'copy' },
      { name: 'name', title: '渠道名称' },
      { name: 'driver', title: '驱动', type: 'label' },
      { name: 'status', title: '状态', type: 'label' },
      { name: 'priority', title: '优先级' },
      {
        title: '需要卡密',
        callback: (item) => (
          <span>{item.requiresCardkey ? '是' : '否'}</span>
        ),
      },
      {
        title: '库存数量',
        callback: (item) => (
          <span
            className={
              item.requiresCardkey && item.availableCount === 0
                ? 'text-destructive font-medium'
                : ''
            }
          >
            {item.requiresCardkey ? item.availableCount : '-'}
          </span>
        ),
      },
      {
        title: '操作',
        callback: (item) => (
          <a
            href={`/admin/upgrade-channels/${item.id}/cardkeys`}
            className="text-primary hover:underline text-sm"
          >
            查看卡密
          </a>
        ),
      },
    ],
    data: channelsWithStock,
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title="升级渠道列表" />
        <TableCard table={table} />
      </Main>
    </>
  );
}
