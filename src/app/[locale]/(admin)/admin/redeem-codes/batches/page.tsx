import { setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getBatchList } from '@/shared/models/redeem-code';
import { Crumb } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function RedeemCodeBatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.REDEEM_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { page: pageNum, pageSize } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '卡密列表', url: '/admin/redeem-codes' },
    { title: '批次列表', is_active: true },
  ];

  const { items, total } = await getBatchList(page, limit);

  const table: Table = {
    columns: [
      { name: 'title', title: '批次名称' },
      { name: 'productCode', title: '产品', type: 'label' },
      { name: 'count', title: '生成数量' },
      {
        title: '单价（元）',
        callback: (item) => (
          <span>{(item.unitPrice / 100).toFixed(2)}</span>
        ),
      },
      { name: 'createdAt', title: '创建时间', type: 'time' },
      {
        title: '操作',
        callback: (item) => (
          <a
            href={`/admin/redeem-codes/batches/${item.id}`}
            className="text-primary hover:underline text-sm"
          >
            查看详情
          </a>
        ),
      },
    ],
    data: items,
    pagination: {
      total,
      page,
      limit,
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title="卡密批次列表" />
        <TableCard table={table} />
      </Main>
    </>
  );
}
