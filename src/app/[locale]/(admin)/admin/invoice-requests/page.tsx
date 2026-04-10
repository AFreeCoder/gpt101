import { and, count, desc, eq } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { invoiceRequest } from '@/config/db/schema';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { Crumb, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function InvoiceRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    status?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.INVOICE_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { page: pageNum, pageSize, status } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;
  const offset = (page - 1) * limit;

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '发票管理', is_active: true },
  ];

  const tabs: Tab[] = [
    {
      name: 'all',
      title: '全部',
      url: '/admin/invoice-requests',
      is_active: !status || status === 'all',
    },
    {
      name: 'submitted',
      title: '已提交',
      url: '/admin/invoice-requests?status=submitted',
      is_active: status === 'submitted',
    },
    {
      name: 'exported',
      title: '已导出',
      url: '/admin/invoice-requests?status=exported',
      is_active: status === 'exported',
    },
    {
      name: 'sent',
      title: '已发送',
      url: '/admin/invoice-requests?status=sent',
      is_active: status === 'sent',
    },
  ];

  const where =
    status && status !== 'all'
      ? eq(invoiceRequest.status, status)
      : undefined;

  const [{ total }] = await db()
    .select({ total: count() })
    .from(invoiceRequest)
    .where(where);

  const items = await db()
    .select()
    .from(invoiceRequest)
    .where(where)
    .orderBy(desc(invoiceRequest.createdAt))
    .limit(limit)
    .offset(offset);

  const table: Table = {
    columns: [
      { name: 'recipientEmail', title: '收件邮箱' },
      { name: 'buyerName', title: '购买方名称', placeholder: '-' },
      { name: 'buyerType', title: '购买方类型', type: 'label', placeholder: '-' },
      {
        title: '开票金额（元）',
        callback: (item) => (
          <span>
            {item.invoiceAmount != null
              ? (item.invoiceAmount / 100).toFixed(2)
              : '-'}
          </span>
        ),
      },
      { name: 'status', title: '状态', type: 'label' },
      {
        name: 'submittedAt',
        title: '提交时间',
        type: 'time',
        placeholder: '-',
      },
      { name: 'sentAt', title: '发送时间', type: 'time', placeholder: '-' },
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
        <MainHeader title="发票管理" tabs={tabs} />
        <TableCard table={table} />
      </Main>
    </>
  );
}
