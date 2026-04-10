import { setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getCodeList } from '@/shared/models/redeem-code';
import { Crumb, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function RedeemCodesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.REDEEM_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { page: pageNum, pageSize, status, search } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '卡密列表', is_active: true },
  ];

  const tabs: Tab[] = [
    {
      name: 'all',
      title: '全部',
      url: '/admin/redeem-codes',
      is_active: !status || status === 'all',
    },
    {
      name: 'available',
      title: '可用',
      url: '/admin/redeem-codes?status=available',
      is_active: status === 'available',
    },
    {
      name: 'consuming',
      title: '使用中',
      url: '/admin/redeem-codes?status=consuming',
      is_active: status === 'consuming',
    },
    {
      name: 'consumed',
      title: '已消费',
      url: '/admin/redeem-codes?status=consumed',
      is_active: status === 'consumed',
    },
    {
      name: 'disabled',
      title: '已禁用',
      url: '/admin/redeem-codes?status=disabled',
      is_active: status === 'disabled',
    },
  ];

  const { items, total } = await getCodeList({
    page,
    pageSize: limit,
    status: status && status !== 'all' ? status : undefined,
    search: search as string | undefined,
  });

  const table: Table = {
    columns: [
      { name: 'code', title: '卡密', type: 'copy' },
      { name: 'productCode', title: '产品', type: 'label' },
      { name: 'status', title: '状态', type: 'label' },
      { name: 'batchId', title: '批次 ID', placeholder: '-' },
      { name: 'exportedAt', title: '导出时间', type: 'time', placeholder: '-' },
      { name: 'usedAt', title: '使用时间', type: 'time', placeholder: '-' },
      { name: 'createdAt', title: '创建时间', type: 'time' },
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
        <MainHeader title="卡密列表" tabs={tabs} />
        <TableCard table={table} />
      </Main>
    </>
  );
}
