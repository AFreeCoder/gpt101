'use client';

import { useCallback, useEffect, useState } from 'react';

import { ListPagination } from '@/shared/blocks/admin/list-pagination';
import { Header } from '@/shared/blocks/dashboard';
import { formatTimestampWithoutTimeZone } from '@/shared/lib/time';

interface Attempt {
  id: string;
  taskId: string;
  taskNo?: string;
  redeemCodePlain?: string;
  channelId: string;
  channelName?: string;
  channelCardkeyId: string | null;
  channelCardkeyValue?: string;
  attemptNo: number;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  success: { label: '成功', color: 'text-green-600 bg-green-50' },
  failed: { label: '失败', color: 'text-red-600 bg-red-50' },
  running: { label: '执行中', color: 'text-blue-600 bg-blue-50' },
};

export default function UpgradeTaskAttemptsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await fetch(
        `/api/admin/upgrade-task-attempts/list?${params}`
      );
      const data = await res.json();
      if (data.code === 0) {
        setAttempts(data.data.items);
        setTotal(data.data.total);
      }
    } catch {}
    setLoading(false);
  }, [statusFilter, search, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <Header />
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">任务记录</h2>

        {/* 状态 Tab */}
        <div className="mb-4 flex gap-1 border-b">
          {[
            { key: '', label: '全部' },
            { key: 'success', label: '成功' },
            { key: 'failed', label: '失败' },
            { key: 'running', label: '执行中' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`px-4 py-2 text-sm ${statusFilter === tab.key ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                fetchData();
              }
            }}
            placeholder="搜索任务编号、本站卡密"
            className="w-80 rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  任务编号
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  本站卡密
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">渠道</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  渠道卡密
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  尝试序号
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">状态</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  错误信息
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">耗时</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  开始时间
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  完成时间
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    加载中...
                  </td>
                </tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    暂无记录
                  </td>
                </tr>
              ) : (
                attempts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t align-top hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {a.taskNo || a.taskId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {a.redeemCodePlain || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {a.channelName || a.channelId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {a.channelCardkeyValue || '-'}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {a.attemptNo}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[a.status]?.color || ''}`}
                      >
                        {STATUS_MAP[a.status]?.label || a.status}
                      </span>
                    </td>
                    <td
                      className="max-w-[720px] min-w-[420px] px-3 py-2 text-xs break-words whitespace-normal text-gray-500"
                      title={a.errorMessage || ''}
                    >
                      {a.errorMessage || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                      {a.durationMs != null
                        ? `${(a.durationMs / 1000).toFixed(1)}s`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                      {formatTimestampWithoutTimeZone(a.startedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                      {formatTimestampWithoutTimeZone(a.finishedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>
    </>
  );
}
