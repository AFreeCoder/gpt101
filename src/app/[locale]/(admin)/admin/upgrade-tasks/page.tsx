'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProductMemberLabel } from '@/shared/lib/redeem-code';

interface Task {
  id: string;
  taskNo: string;
  productCode: string;
  memberType: string;
  redeemCodePlain: string;
  chatgptEmail: string;
  chatgptCurrentPlan: string | null;
  sessionToken: string;
  status: string;
  attemptCount: number;
  successChannelId: string | null;
  successChannelCardkeyId: string | null;
  lastError: string | null;
  resultMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'text-yellow-600 bg-yellow-50' },
  running: { label: '执行中', color: 'text-blue-600 bg-blue-50' },
  succeeded: { label: '成功', color: 'text-green-600 bg-green-50' },
  failed: { label: '失败', color: 'text-red-600 bg-red-50' },
  canceled: { label: '已取消', color: 'text-gray-500 bg-gray-100' },
};

export default function UpgradeTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '30' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/upgrade-tasks/list?${params}`);
      const data = await res.json();
      if (data.code === 0) { setTasks(data.data.items); setTotal(data.data.total); }
    } catch {}
    setLoading(false);
  }, [statusFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 管理操作
  const handleAction = async (taskId: string, action: 'retry' | 'cancel' | 'markSuccess') => {
    const labels = { retry: '重试', cancel: '取消', markSuccess: '标记成功' };
    if (!confirm(`确定${labels[action]}此任务？`)) return;
    try {
      const res = await fetch(`/api/admin/upgrade-tasks/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.code !== 0) alert(data.message);
      else fetchData();
    } catch { alert('操作失败'); }
  };

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">任务结果</h2>

      {/* 状态 Tab */}
      <div className="mb-4 flex gap-1 border-b">
        {[
          { key: '', label: '全部' },
          { key: 'pending', label: '排队中' },
          { key: 'running', label: '执行中' },
          { key: 'succeeded', label: '成功' },
          { key: 'failed', label: '失败' },
          { key: 'canceled', label: '已取消' },
        ].map((tab) => (
          <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-4 py-2 text-sm ${statusFilter === tab.key ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜索 */}
      <div className="mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchData(); } }}
          placeholder="搜索任务编号、卡密、邮箱" className="rounded-lg border px-3 py-1.5 text-sm w-80" />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">任务编号</th>
              <th className="px-3 py-2 text-left">产品/会员</th>
              <th className="px-3 py-2 text-left">本站卡密</th>
              <th className="px-3 py-2 text-left">用户邮箱</th>
              <th className="px-3 py-2 text-left">当前会员</th>
              <th className="px-3 py-2 text-left">升级状态</th>
              <th className="px-3 py-2 text-left">升级结果</th>
              <th className="px-3 py-2 text-left">尝试次数</th>
              <th className="px-3 py-2 text-left">创建时间</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{t.taskNo}</td>
                  <td className="px-3 py-2 text-xs">{getProductMemberLabel(t.productCode, t.memberType)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t.redeemCodePlain}</td>
                  <td className="px-3 py-2 text-xs">{t.chatgptEmail}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.chatgptCurrentPlan || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[t.status]?.color || ''}`}>
                      {STATUS_MAP[t.status]?.label || t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-48 truncate" title={t.resultMessage || t.lastError || ''}>
                    {t.resultMessage || t.lastError || '-'}
                  </td>
                  <td className="px-3 py-2 text-center">{t.attemptCount}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {t.status === 'failed' && (
                        <>
                          <button onClick={() => handleAction(t.id, 'retry')} className="text-xs text-blue-600 hover:underline">重试</button>
                          <button onClick={() => handleAction(t.id, 'markSuccess')} className="text-xs text-green-600 hover:underline">标记成功</button>
                          <button onClick={() => handleAction(t.id, 'cancel')} className="text-xs text-red-600 hover:underline">取消</button>
                        </>
                      )}
                      {t.status === 'pending' && (
                        <button onClick={() => handleAction(t.id, 'cancel')} className="text-xs text-red-600 hover:underline">取消</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <button onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">上一页</button>}
          <span className="px-3 py-1 text-sm text-gray-500">第 {page} 页，共 {Math.ceil(total / 30)} 页</span>
          {page * 30 < total && <button onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">下一页</button>}
        </div>
      )}
    </div>
  );
}
