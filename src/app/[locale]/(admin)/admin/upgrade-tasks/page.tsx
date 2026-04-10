import { setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { getTaskList } from '@/shared/services/upgrade-task';
import { Crumb, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function UpgradeTasksPage({
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
    code: PERMISSIONS.UPGRADE_TASK_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { page: pageNum, pageSize, status, search } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;

  const crumbs: Crumb[] = [
    { title: '管理后台', url: '/admin' },
    { title: '升级任务', is_active: true },
  ];

  const tabs: Tab[] = [
    {
      name: 'all',
      title: '全部',
      url: '/admin/upgrade-tasks',
      is_active: !status || status === 'all',
    },
    {
      name: 'pending',
      title: '排队中',
      url: '/admin/upgrade-tasks?status=pending',
      is_active: status === 'pending',
    },
    {
      name: 'running',
      title: '执行中',
      url: '/admin/upgrade-tasks?status=running',
      is_active: status === 'running',
    },
    {
      name: 'succeeded',
      title: '成功',
      url: '/admin/upgrade-tasks?status=succeeded',
      is_active: status === 'succeeded',
    },
    {
      name: 'failed',
      title: '失败',
      url: '/admin/upgrade-tasks?status=failed',
      is_active: status === 'failed',
    },
    {
      name: 'canceled',
      title: '已取消',
      url: '/admin/upgrade-tasks?status=canceled',
      is_active: status === 'canceled',
    },
  ];

  const { items, total } = await getTaskList({
    page,
    pageSize: limit,
    status: status && status !== 'all' ? status : undefined,
    search: search as string | undefined,
  });

  const table: Table = {
    columns: [
      { name: 'taskNo', title: '任务编号', type: 'copy' },
      { name: 'redeemCodePlain', title: '卡密', type: 'copy' },
      { name: 'chatgptEmail', title: 'ChatGPT 账号' },
      { name: 'productCode', title: '产品', type: 'label' },
      { name: 'status', title: '状态', type: 'label' },
      { name: 'attemptCount', title: '尝试次数' },
      {
        title: '最后错误',
        placeholder: '-',
        callback: (item) => {
          if (!item.lastError) return <span className="text-muted-foreground">-</span>;
          const text =
            item.lastError.length > 60
              ? item.lastError.slice(0, 60) + '...'
              : item.lastError;
          return (
            <span className="text-destructive text-xs" title={item.lastError}>
              {text}
            </span>
          );
        },
      },
      { name: 'createdAt', title: '创建时间', type: 'time' },
      {
        name: 'finishedAt',
        title: '完成时间',
        type: 'time',
        placeholder: '-',
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
        <MainHeader title="升级任务列表" tabs={tabs} />
        <TableCard table={table} />
      </Main>
    </>
  );
}
