import { setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getCodeList } from '@/shared/models/redeem-code';
import { getProductMemberLabel, PRODUCT_TYPES } from '@/shared/lib/redeem-code';
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
    productCode?: string;
    memberType?: string;
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

  const sp = await searchParams;
  const page = sp.page || 1;
  const limit = sp.pageSize || 30;

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '卡密列表', is_active: true },
  ];

  const tabs: Tab[] = [
    { name: 'all', title: '全部', url: '/admin/redeem-codes', is_active: !sp.status },
    { name: 'available', title: '可用', url: '/admin/redeem-codes?status=available', is_active: sp.status === 'available' },
    { name: 'consumed', title: '已使用', url: '/admin/redeem-codes?status=consumed', is_active: sp.status === 'consumed' },
    { name: 'disabled', title: '已禁用', url: '/admin/redeem-codes?status=disabled', is_active: sp.status === 'disabled' },
  ];

  const { items, total } = await getCodeList({
    page,
    pageSize: limit,
    status: sp.status,
    productCode: sp.productCode,
    memberType: sp.memberType,
    search: sp.search,
  });

  const table: Table = {
    columns: [
      { name: 'code', title: '卡密', type: 'copy' },
      {
        name: 'productCode',
        title: '产品/会员',
        callback: (item) => (
          <span>{getProductMemberLabel(item.productCode, item.memberType)}</span>
        ),
      },
      { name: 'status', title: '状态' },
      { name: 'batchId', title: '批次' },
      { name: 'createdAt', title: '创建时间', type: 'time' },
      { name: 'usedAt', title: '使用时间', type: 'time', placeholder: '-' },
    ],
    data: items,
    pagination: { total, page, limit },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title="卡密列表" tabs={tabs} />

        {/* 筛选条件 */}
        <div className="mb-4 flex flex-wrap gap-2 px-4">
          {PRODUCT_TYPES.map((p) => (
            <a
              key={p.code}
              href={`/admin/redeem-codes?productCode=${p.code}${sp.status ? `&status=${sp.status}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs ${sp.productCode === p.code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {p.label}
            </a>
          ))}
          {sp.productCode && (
            <a
              href={`/admin/redeem-codes${sp.status ? `?status=${sp.status}` : ''}`}
              className="rounded-full px-3 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200"
            >
              清除筛选
            </a>
          )}
        </div>

        <TableCard table={table} />
      </Main>
    </>
  );
}
