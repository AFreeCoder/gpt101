'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { ListPagination } from '@/shared/blocks/admin/list-pagination';
import { Header } from '@/shared/blocks/dashboard';
import { formatTimestampWithoutTimeZone } from '@/shared/lib/time';

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
  successChannelName: string;
  successChannelCardkey: string;
  lastError: string | null;
  resultMessage: string | null;
  manualRequired?: boolean;
  manualRequiredReason?: string;
  sourceType: 'partner' | 'site';
  partnerAppId: string | null;
  partnerAppKey: string | null;
  partnerAppName: string | null;
  partnerOrderId: string | null;
  externalOrderNo: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface ManualEntryForm {
  redeemCode: string;
  chatgptEmail: string;
  sessionToken: string;
  channelId: string;
  channelCardkey: string;
  note: string;
}

function getEmptyManualEntryForm(): ManualEntryForm {
  return {
    redeemCode: '',
    chatgptEmail: '',
    sessionToken: '',
    channelId: '',
    channelCardkey: '',
    note: '',
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'text-yellow-600 bg-yellow-50' },
  running: { label: '执行中', color: 'text-blue-600 bg-blue-50' },
  succeeded: { label: '成功', color: 'text-green-600 bg-green-50' },
  failed: { label: '失败', color: 'text-red-600 bg-red-50' },
  canceled: { label: '已取消', color: 'text-gray-500 bg-gray-100' },
};

const SOURCE_FILTERS = [
  { key: '', label: '按订单来源筛选' },
  { key: 'partner', label: '第三方订单' },
  { key: 'site', label: '本站卡密充值' },
];

function getPartnerSourceName(task: Task) {
  return task.partnerAppName || task.partnerAppKey || '';
}

function getOrderSourceLabel(task: Task) {
  return task.sourceType === 'partner'
    ? getPartnerSourceName(task) || '第三方接入'
    : '本站卡密充值';
}

export default function UpgradeTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [viewToken, setViewToken] = useState('');
  const [showMarkSuccess, setShowMarkSuccess] = useState<string | null>(null); // taskId
  const [msChannelId, setMsChannelId] = useState('');
  const [msChannelCardkey, setMsChannelCardkey] = useState('');
  const [msNote, setMsNote] = useState('');
  const [msSaving, setMsSaving] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [showRebind, setShowRebind] = useState<Task | null>(null);
  const [rbChannelId, setRbChannelId] = useState('');
  const [rbChannelCardkey, setRbChannelCardkey] = useState('');
  const [rbNote, setRbNote] = useState('');
  const [rbSaving, setRbSaving] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState<ManualEntryForm>(
    getEmptyManualEntryForm()
  );
  const [manualEntrySaving, setManualEntrySaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('sourceType', sourceFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/upgrade-tasks/list?${params}`);
      const data = await res.json();
      if (data.code === 0) {
        setTasks(data.data.items);
        setTotal(data.data.total);
      }
    } catch {}
    setLoading(false);
  }, [statusFilter, sourceFilter, search, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 加载渠道列表（标记成功弹窗用）
  useEffect(() => {
    fetch('/api/admin/upgrade-channels/list')
      .then((r) => r.json())
      .then((d) => {
        if (d.code === 0)
          setChannels(d.data.map((c: any) => ({ id: c.id, name: c.name })));
      });
  }, []);

  const handleAction = async (
    taskId: string,
    action: 'retry' | 'cancel' | 'markSuccess'
  ) => {
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
    } catch {
      alert('操作失败');
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (sourceFilter) params.set('sourceType', sourceFilter);
    if (search) params.set('search', search);

    setExporting(true);
    try {
      const res = await fetch(`/api/admin/upgrade-tasks/export?${params}`);
      const contentType = res.headers.get('Content-Type') || '';
      if (!contentType.includes('text/csv')) {
        const data = await res.json().catch(() => null);
        alert(data?.message || '导出失败');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `upgrade-tasks-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const openRebindModal = (task: Task) => {
    setShowRebind(task);
    setRbChannelId(task.successChannelId || '');
    setRbChannelCardkey(task.successChannelCardkey || '');
    setRbNote('');
  };

  const handleRebind = async () => {
    if (!showRebind) return;
    if (!rbChannelId) {
      alert('请选择渠道');
      return;
    }
    if (!rbChannelCardkey.trim()) {
      alert('请输入渠道卡密');
      return;
    }

    setRbSaving(true);
    try {
      const res = await fetch('/api/admin/upgrade-tasks/rebindCardkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: showRebind.id,
          channelId: rbChannelId,
          channelCardkey: rbChannelCardkey,
          note: rbNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.code !== 0) alert(data.message);
      else {
        setShowRebind(null);
        fetchData();
      }
    } catch {
      alert('操作失败');
    }
    setRbSaving(false);
  };

  const updateManualEntry = (patch: Partial<ManualEntryForm>) => {
    setManualEntry((current) => ({ ...current, ...patch }));
  };

  const openManualEntryModal = () => {
    setManualEntry(getEmptyManualEntryForm());
    setShowManualEntry(true);
  };

  const handleManualEntry = async () => {
    if (!manualEntry.redeemCode.trim()) {
      alert('请输入本站卡密');
      return;
    }
    if (!manualEntry.chatgptEmail.trim()) {
      alert('请输入用户邮箱');
      return;
    }
    if (!manualEntry.sessionToken.trim()) {
      alert('请输入用户 Token');
      return;
    }
    if (manualEntry.channelCardkey.trim() && !manualEntry.channelId) {
      alert('填写上游渠道卡密时必须选择渠道');
      return;
    }

    setManualEntrySaving(true);
    try {
      const res = await fetch('/api/admin/upgrade-tasks/manualEntry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redeemCode: manualEntry.redeemCode,
          chatgptEmail: manualEntry.chatgptEmail,
          sessionToken: manualEntry.sessionToken,
          channelId: manualEntry.channelId || undefined,
          channelCardkey: manualEntry.channelCardkey || undefined,
          note: manualEntry.note || undefined,
        }),
      });
      const data = await res.json();
      if (data.code !== 0) alert(data.message);
      else {
        setShowManualEntry(false);
        if (data.data?.taskNo) {
          setStatusFilter('');
          setSearch(data.data.taskNo);
          setPage(1);
        }
        fetchData();
      }
    } catch {
      alert('补录失败');
    }
    setManualEntrySaving(false);
  };

  return (
    <>
      <Header />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">任务结果</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? '导出中...' : '导出'}
            </button>
            <button
              onClick={openManualEntryModal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              任务补录
            </button>
          </div>
        </div>

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
        <div className="mb-4 flex flex-wrap gap-2">
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
            placeholder="搜索任务编号、卡密、邮箱、订单号"
            className="w-80 rounded-lg border px-3 py-1.5 text-sm"
          />
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border px-3 py-1.5 text-sm"
            aria-label="订单来源"
          >
            {SOURCE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">本站卡密</th>
                <th className="px-3 py-2 text-left">用户邮箱</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">订单来源</th>
                <th className="px-3 py-2 text-left">订单/流水号</th>
                <th className="px-3 py-2 text-left">渠道/卡密</th>
                <th className="px-3 py-2 text-left">Token</th>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    加载中...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.redeemCodePlain}
                    </td>
                    <td className="px-3 py-2 text-xs">{t.chatgptEmail}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[t.status]?.color || ''}`}
                      >
                        {STATUS_MAP[t.status]?.label || t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <span
                        className={`inline-block max-w-40 truncate rounded-full px-2 py-0.5 align-middle font-medium ${t.sourceType === 'partner' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}
                        title={getOrderSourceLabel(t)}
                      >
                        {getOrderSourceLabel(t)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {t.externalOrderNo ? (
                        <span title={t.externalOrderNo}>
                          {t.externalOrderNo}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {t.status === 'succeeded' ? (
                        <div>
                          <span>{t.successChannelName}</span>
                          {t.successChannelCardkey && (
                            <div
                              className="max-w-32 truncate font-mono text-gray-400"
                              title={t.successChannelCardkey}
                            >
                              {t.successChannelCardkey}
                            </div>
                          )}
                        </div>
                      ) : t.status === 'failed' ? (
                        <span
                          className="block max-w-36 truncate text-gray-400"
                          title={t.lastError || ''}
                        >
                          {t.lastError || '-'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setViewToken(t.sessionToken)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        查看
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                      {formatTimestampWithoutTimeZone(t.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {(t.status === 'failed' || t.status === 'canceled') && (
                          <>
                            {!t.manualRequired && (
                              <button
                                onClick={() => handleAction(t.id, 'retry')}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                重试
                              </button>
                            )}
                            {t.manualRequired && (
                              <span
                                className="text-xs text-gray-400"
                                title={
                                  t.manualRequiredReason ||
                                  t.lastError ||
                                  '该任务需人工处理，不能直接重试'
                                }
                              >
                                需人工处理
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setShowMarkSuccess(t.id);
                                setMsChannelId('');
                                setMsChannelCardkey('');
                                setMsNote('');
                              }}
                              className="text-xs text-green-600 hover:underline"
                            >
                              标记成功
                            </button>
                            {t.status === 'failed' && !t.manualRequired && (
                              <button
                                onClick={() => handleAction(t.id, 'cancel')}
                                className="text-xs text-red-600 hover:underline"
                              >
                                取消
                              </button>
                            )}
                          </>
                        )}
                        {t.status === 'pending' && (
                          <button
                            onClick={() => handleAction(t.id, 'cancel')}
                            className="text-xs text-red-600 hover:underline"
                          >
                            取消
                          </button>
                        )}
                        {t.status === 'succeeded' && (
                          <button
                            onClick={() => openRebindModal(t)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            更换卡密
                          </button>
                        )}
                      </div>
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

        {/* 任务补录弹窗 */}
        {showManualEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowManualEntry(false)}
            />
            <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">任务补录</h3>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    本站卡密
                  </label>
                  <input
                    type="text"
                    value={manualEntry.redeemCode}
                    onChange={(e) =>
                      updateManualEntry({ redeemCode: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    用户邮箱
                  </label>
                  <input
                    type="email"
                    value={manualEntry.chatgptEmail}
                    onChange={(e) =>
                      updateManualEntry({ chatgptEmail: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    使用渠道
                  </label>
                  <select
                    value={manualEntry.channelId}
                    onChange={(e) =>
                      updateManualEntry({ channelId: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">未选择渠道</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    上游渠道卡密
                  </label>
                  <input
                    type="text"
                    value={manualEntry.channelCardkey}
                    onChange={(e) =>
                      updateManualEntry({ channelCardkey: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    用户 Token
                  </label>
                  <textarea
                    value={manualEntry.sessionToken}
                    onChange={(e) =>
                      updateManualEntry({ sessionToken: e.target.value })
                    }
                    rows={7}
                    className="w-full rounded-lg border px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">备注</label>
                  <input
                    type="text"
                    value={manualEntry.note}
                    onChange={(e) =>
                      updateManualEntry({ note: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  disabled={manualEntrySaving}
                  onClick={handleManualEntry}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {manualEntrySaving ? '保存中...' : '确认补录'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Token 查看弹窗 */}
        {viewToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setViewToken('')}
            />
            <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Session Token</h3>
                <button
                  onClick={() => setViewToken('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <textarea
                readOnly
                value={viewToken}
                rows={8}
                className="w-full rounded-lg border bg-gray-50 p-3 font-mono text-xs break-all"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(viewToken);
                    alert('已复制');
                  }}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  复制
                </button>
                <button
                  onClick={() => setViewToken('')}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 标记成功弹窗 */}
        {showMarkSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMarkSuccess(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold">标记任务成功</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    使用的渠道
                  </label>
                  <select
                    value={msChannelId}
                    onChange={(e) => setMsChannelId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">请选择</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    使用的渠道卡密
                  </label>
                  <input
                    type="text"
                    value={msChannelCardkey}
                    onChange={(e) => setMsChannelCardkey(e.target.value)}
                    placeholder="输入渠道卡密（如有）"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">备注</label>
                  <input
                    type="text"
                    value={msNote}
                    onChange={(e) => setMsNote(e.target.value)}
                    placeholder="可选"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowMarkSuccess(null)}
                  className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  disabled={msSaving}
                  onClick={async () => {
                    setMsSaving(true);
                    try {
                      const res = await fetch(
                        '/api/admin/upgrade-tasks/markSuccess',
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            taskId: showMarkSuccess,
                            channelId: msChannelId || undefined,
                            channelCardkey: msChannelCardkey || undefined,
                            note: msNote || undefined,
                          }),
                        }
                      );
                      const data = await res.json();
                      if (data.code !== 0) alert(data.message);
                      else {
                        setShowMarkSuccess(null);
                        fetchData();
                      }
                    } catch {
                      alert('操作失败');
                    }
                    setMsSaving(false);
                  }}
                  className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {msSaving ? '处理中...' : '确认标记成功'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 更换渠道卡密弹窗 */}
        {showRebind && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowRebind(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-semibold">更换绑定渠道卡密</h3>
              <div className="mb-3 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
                当前任务：{showRebind.taskNo}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">渠道</label>
                  <select
                    value={rbChannelId}
                    onChange={(e) => setRbChannelId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">请选择</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    新渠道卡密
                  </label>
                  <input
                    type="text"
                    value={rbChannelCardkey}
                    onChange={(e) => setRbChannelCardkey(e.target.value)}
                    placeholder="输入正确的渠道卡密"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">备注</label>
                  <input
                    type="text"
                    value={rbNote}
                    onChange={(e) => setRbNote(e.target.value)}
                    placeholder="可选"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowRebind(null)}
                  className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  disabled={rbSaving}
                  onClick={handleRebind}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {rbSaving ? '保存中...' : '确认更换'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
