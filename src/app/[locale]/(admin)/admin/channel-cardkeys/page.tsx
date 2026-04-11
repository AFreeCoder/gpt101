'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PRODUCT_TYPES,
  getMemberTypes,
  getProductMemberLabel,
} from '@/shared/lib/redeem-code';

interface CardKey {
  id: string;
  channelId: string;
  cardkey: string;
  productCode: string;
  memberType: string;
  status: string;
  createdAt: string;
  usedAt: string | null;
}

interface Channel {
  id: string;
  name: string;
  code: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: '可用', color: 'text-green-600 bg-green-50' },
  locked: { label: '锁定', color: 'text-yellow-600 bg-yellow-50' },
  used: { label: '已使用', color: 'text-gray-500 bg-gray-100' },
  disabled: { label: '已禁用', color: 'text-red-600 bg-red-50' },
};

export default function ChannelCardkeysPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cardkeys, setCardkeys] = useState<CardKey[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 筛选
  const [channelId, setChannelId] = useState('');
  const [productCode, setProductCode] = useState('');
  const [memberType, setMemberType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // 导入弹窗
  const [showImport, setShowImport] = useState(false);
  const [importChannelId, setImportChannelId] = useState('');
  const [importProductCode, setImportProductCode] = useState('');
  const [importMemberType, setImportMemberType] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // 导出弹窗
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const memberTypes = productCode ? getMemberTypes(productCode) : [];
  const importMemberTypes = importProductCode ? getMemberTypes(importProductCode) : [];

  // 加载渠道列表
  useEffect(() => {
    fetch('/api/admin/upgrade-channels/list')
      .then((r) => r.json())
      .then((d) => { if (d.code === 0) setChannels(d.data); });
  }, []);

  // 加载卡密
  const fetchData = useCallback(async () => {
    if (!channelId) { setCardkeys([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ channelId, page: String(page), pageSize: '30' });
      if (productCode) params.set('productCode', productCode);
      if (memberType) params.set('memberType', memberType);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/channel-cardkeys/list?${params}`);
      const data = await res.json();
      if (data.code === 0) { setCardkeys(data.data.items); setTotal(data.data.total); }
    } catch {}
    setLoading(false);
  }, [channelId, productCode, memberType, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 全选
  const toggleAll = () => {
    if (selectedIds.size === cardkeys.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(cardkeys.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    // 过滤掉 used 状态的
    const deletable = cardkeys.filter((c) => selectedIds.has(c.id) && c.status !== 'used' && c.status !== 'locked');
    if (deletable.length === 0) { alert('选中的卡密中没有可删除的（已使用/锁定的不能删除）'); return; }
    if (!confirm(`确定删除 ${deletable.length} 张卡密？`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/channel-cardkeys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletable.map((c) => c.id) }),
      });
      const data = await res.json();
      if (data.code === 0) { setSelectedIds(new Set()); fetchData(); }
      else alert(data.message);
    } catch { alert('删除失败'); }
    setActionLoading(false);
  };

  // 导入
  const handleImport = async () => {
    setError('');
    if (!importChannelId) { setError('请选择渠道'); return; }
    if (!importProductCode) { setError('请选择产品类型'); return; }
    if (!importMemberType) { setError('请选择会员类型'); return; }
    if (!importText.trim()) { setError('请粘贴卡密'); return; }

    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError('请粘贴卡密'); return; }

    setImporting(true);
    try {
      const res = await fetch('/api/admin/channel-cardkeys/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: importChannelId,
          productCode: importProductCode,
          memberType: importMemberType,
          cardkeys: lines,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        alert(`导入成功：${data.data.importedCount} 张，跳过：${data.data.skippedCount} 张`);
        setShowImport(false);
        setImportText('');
        if (channelId === importChannelId) fetchData();
      } else { setError(data.message); }
    } catch { setError('导入失败'); }
    setImporting(false);
  };

  // 导出
  const handleExport = () => {
    const texts = cardkeys.map((c) => c.cardkey).join('\n');
    setExportText(texts);
    setShowExport(true);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">渠道卡密管理</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={cardkeys.length === 0}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">导出</button>
          <button onClick={() => { setShowImport(true); setError(''); }}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">导入卡密</button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={channelId} onChange={(e) => { setChannelId(e.target.value); setPage(1); setSelectedIds(new Set()); }}
          className="rounded-lg border px-3 py-1.5 text-sm">
          <option value="">选择渠道</option>
          {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
        </select>

        <select value={productCode} onChange={(e) => { setProductCode(e.target.value); setMemberType(''); setPage(1); }}
          className="rounded-lg border px-3 py-1.5 text-sm">
          <option value="">全部产品</option>
          {PRODUCT_TYPES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        </select>

        {productCode && memberTypes.length > 0 && (
          <select value={memberType} onChange={(e) => { setMemberType(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-1.5 text-sm">
            <option value="">全部会员</option>
            {memberTypes.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        )}

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border px-3 py-1.5 text-sm">
          <option value="">全部状态</option>
          <option value="available">可用</option>
          <option value="locked">锁定</option>
          <option value="used">已使用</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>

      {/* 批量操作 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2">
          <span className="text-sm text-blue-700">已选 {selectedIds.size} 项</span>
          <button onClick={handleBatchDelete} disabled={actionLoading}
            className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50">批量删除</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">取消选择</button>
        </div>
      )}

      {!channelId ? (
        <div className="rounded-lg border py-16 text-center text-gray-400">请先选择一个渠道</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" checked={selectedIds.size === cardkeys.length && cardkeys.length > 0} onChange={toggleAll} /></th>
                <th className="px-3 py-2 text-left">卡密</th>
                <th className="px-3 py-2 text-left">产品/会员</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">创建时间</th>
                <th className="px-3 py-2 text-left">使用时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
              ) : cardkeys.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">暂无卡密</td></tr>
              ) : (
                cardkeys.map((ck) => (
                  <tr key={ck.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selectedIds.has(ck.id)} onChange={() => toggleOne(ck.id)}
                        disabled={ck.status === 'used' || ck.status === 'locked'} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{ck.cardkey}</td>
                    <td className="px-3 py-2 text-xs">{getProductMemberLabel(ck.productCode, ck.memberType)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[ck.status]?.color || ''}`}>
                        {STATUS_MAP[ck.status]?.label || ck.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(ck.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{ck.usedAt ? new Date(ck.usedAt).toLocaleString('zh-CN') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {total > 30 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <button onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">上一页</button>}
          <span className="px-3 py-1 text-sm text-gray-500">第 {page} 页，共 {Math.ceil(total / 30)} 页</span>
          {page * 30 < total && <button onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">下一页</button>}
        </div>
      )}

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowImport(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">导入渠道卡密</h3>
            {error && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">渠道</label>
                <select value={importChannelId} onChange={(e) => setImportChannelId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">请选择</option>
                  {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">产品类型</label>
                <select value={importProductCode} onChange={(e) => { setImportProductCode(e.target.value); setImportMemberType(''); }}
                  className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">请选择</option>
                  {PRODUCT_TYPES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">会员类型</label>
                <select value={importMemberType} onChange={(e) => setImportMemberType(e.target.value)}
                  disabled={!importProductCode} className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">请选择</option>
                  {importMemberTypes.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">卡密（一行一个）</label>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
                  rows={8} placeholder="粘贴渠道卡密，每行一个..." className="w-full rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setShowImport(false)} className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleImport} disabled={importing}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {importing ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导出弹窗 */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExport(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">导出卡密（{cardkeys.length} 张）</h3>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea readOnly value={exportText} rows={12} className="w-full rounded-lg border bg-gray-50 p-3 font-mono text-sm" />
            <div className="mt-4 flex gap-3">
              <button onClick={async () => { await navigator.clipboard.writeText(exportText); alert('已复制'); }}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">一键复制全部</button>
              <button onClick={() => setShowExport(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
