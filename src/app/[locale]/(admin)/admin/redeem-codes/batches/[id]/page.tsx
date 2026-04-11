import { setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getBatchById, getBatchStats, getCodeList } from '@/shared/models/redeem-code';
import { getProductMemberLabel, STATUS_LABELS, STATUS_COLORS } from '@/shared/lib/redeem-code';
import { Crumb } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: number; pageSize?: number }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.REDEEM_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const batch = await getBatchById(id);
  if (!batch) {
    return (
      <Main>
        <div className="p-8 text-center text-gray-500">批次不存在</div>
      </Main>
    );
  }

  const sp = await searchParams;
  const page = sp.page || 1;
  const limit = sp.pageSize || 50;

  const stats = await getBatchStats(id);
  const { items, total } = await getCodeList({ batchId: id, page, pageSize: limit });

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '批次管理', url: '/admin/redeem-codes/batches' },
    { title: batch.title, is_active: true },
  ];

  const table: Table = {
    columns: [
      { name: 'code', title: '卡密', type: 'copy' },
      {
        name: 'status',
        title: '状态',
        callback: (item) => (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
        ),
      },
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
        <MainHeader title={`批次: ${batch.title}`} />

        {/* 批次信息 */}
        <div className="mb-6 grid grid-cols-2 gap-4 px-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">产品/会员</div>
            <div className="mt-1 font-medium">{getProductMemberLabel(batch.productCode, batch.memberType)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">总数</div>
            <div className="mt-1 font-medium">{batch.count}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">单价</div>
            <div className="mt-1 font-medium">¥{batch.unitPrice}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">使用进度</div>
            <div className="mt-1 font-medium">
              {stats.map((s) => (
                <span key={s.status} className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                  {STATUS_LABELS[s.status] || s.status}: {s.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        <TableCard table={table} />
      </Main>
    </>
  );
}
