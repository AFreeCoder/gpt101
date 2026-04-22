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
  successChannelName: string;
  successChannelCardkey: string;
  lastError: string | null;
  resultMessage: string | null;
  manualRequired?: boolean;
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
  const [viewToken, setViewToken] = useState('');
  const [showMarkSuccess, setShowMarkSuccess] = useState<string | null>(null); // taskId
  const [msChannelId, setMsChannelId] = useState('');
  const [msChannelCardkey, setMsChannelCardkey] = useState('');
  const [msNote, setMsNote] = useState('');
  const [msSaving, setMsSaving] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);

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

  // 加载渠道列表（标记成功弹窗用）
  useEffect(() => {
    fetch('/api/admin/upgrade-channels/list')
      .then((r) => r.json())
      .then((d) => { if (d.code === 0) setChannels(d.data.map((c: any) => ({ id: c.id, name: c.name }))); });
  }, []);

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
              <th className="px-3 py-2 text-left">本站卡密</th>
              <th className="px-3 py-2 text-left">用户邮箱</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">渠道/卡密</th>
              <th className="px-3 py-2 text-left">Token</th>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{t.redeemCodePlain}</td>
                  <td className="px-3 py-2 text-xs">{t.chatgptEmail}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[t.status]?.color || ''}`}>
                      {STATUS_MAP[t.status]?.label || t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.status === 'succeeded' ? (
                      <div>
                        <span>{t.successChannelName}</span>
                        {t.successChannelCardkey && (
                          <div className="font-mono text-gray-400 truncate max-w-32" title={t.successChannelCardkey}>{t.successChannelCardkey}</div>
                        )}
                      </div>
                    ) : t.status === 'failed' ? (
                      <span className="text-gray-400 truncate max-w-36 block" title={t.lastError || ''}>{t.lastError || '-'}</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setViewToken(t.sessionToken)} className="text-xs text-blue-600 hover:underline">查看</button>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {(t.status === 'failed' || t.status === 'canceled') && (
                        <>
                          {!t.manualRequired && (
                            <button onClick={() => handleAction(t.id, 'retry')} className="text-xs text-blue-600 hover:underline">重试</button>
                          )}
                          <button onClick={() => { setShowMarkSuccess(t.id); setMsChannelId(''); setMsChannelCardkey(''); setMsNote(''); }} className="text-xs text-green-600 hover:underline">标记成功</button>
                          {t.status === 'failed' && !t.manualRequired && (
                            <button onClick={() => handleAction(t.id, 'cancel')} className="text-xs text-red-600 hover:underline">取消</button>
                          )}
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

      {/* Session Token 查看弹窗 */}
      {viewToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewToken('')} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Session Token</h3>
              <button onClick={() => setViewToken('')} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea readOnly value={viewToken} rows={8}
              className="w-full rounded-lg border bg-gray-50 p-3 font-mono text-xs break-all" />
            <div className="mt-4 flex gap-3">
              <button onClick={async () => { await navigator.clipboard.writeText(viewToken); alert('已复制'); }}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">复制</button>
              <button onClick={() => setViewToken('')}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">关闭</button>
            </div>
          </div>
        </div>
      )}
      {/* 标记成功弹窗 */}
      {showMarkSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMarkSuccess(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">标记任务成功</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">使用的渠道</label>
                <select value={msChannelId} onChange={(e) => setMsChannelId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">请选择</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">使用的渠道卡密</label>
                <input type="text" value={msChannelCardkey} onChange={(e) => setMsChannelCardkey(e.target.value)}
                  placeholder="输入渠道卡密（如有）" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">备注</label>
                <input type="text" value={msNote} onChange={(e) => setMsNote(e.target.value)}
                  placeholder="可选" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowMarkSuccess(null)}
                className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50">取消</button>
              <button disabled={msSaving} onClick={async () => {
                setMsSaving(true);
                try {
                  const res = await fetch('/api/admin/upgrade-tasks/markSuccess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      taskId: showMarkSuccess,
                      channelId: msChannelId || undefined,
                      channelCardkey: msChannelCardkey || undefined,
                      note: msNote || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (data.code !== 0) alert(data.message);
                  else { setShowMarkSuccess(null); fetchData(); }
                } catch { alert('操作失败'); }
                setMsSaving(false);
              }}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {msSaving ? '处理中...' : '确认标记成功'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
