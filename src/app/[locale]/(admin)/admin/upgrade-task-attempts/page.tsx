'use client';

import { useCallback, useEffect, useState } from 'react';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '30',
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
  }, [statusFilter, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
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
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">任务编号</th>
              <th className="px-3 py-2 text-left">本站卡密</th>
              <th className="px-3 py-2 text-left">渠道</th>
              <th className="px-3 py-2 text-left">渠道卡密</th>
              <th className="px-3 py-2 text-left">尝试序号</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">错误信息</th>
              <th className="px-3 py-2 text-left">耗时</th>
              <th className="px-3 py-2 text-left">开始时间</th>
              <th className="px-3 py-2 text-left">完成时间</th>
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
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.taskNo || a.taskId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.redeemCodePlain || '-'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {a.channelName || a.channelId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.channelCardkeyValue || '-'}
                  </td>
                  <td className="px-3 py-2 text-center">{a.attemptNo}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[a.status]?.color || ''}`}
                    >
                      {STATUS_MAP[a.status]?.label || a.status}
                    </span>
                  </td>
                  <td
                    className="max-w-64 truncate px-3 py-2 text-xs text-gray-500"
                    title={a.errorMessage || ''}
                  >
                    {a.errorMessage || '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {a.durationMs != null
                      ? `${(a.durationMs / 1000).toFixed(1)}s`
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {formatTimestampWithoutTimeZone(a.startedAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {formatTimestampWithoutTimeZone(a.finishedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <button
              onClick={() => setPage(page - 1)}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            >
              上一页
            </button>
          )}
          <span className="px-3 py-1 text-sm text-gray-500">
            第 {page} 页，共 {Math.ceil(total / 30)} 页
          </span>
          {page * 30 < total && (
            <button
              onClick={() => setPage(page + 1)}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            >
              下一页
            </button>
          )}
        </div>
      )}
    </div>
  );
}
