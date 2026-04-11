'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  PRODUCT_TYPES,
  getMemberTypes,
  getProductMemberLabel,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/shared/lib/redeem-code';

interface RedeemCode {
  id: string;
  code: string;
  productCode: string;
  memberType: string;
  status: string;
  batchId: string;
  createdAt: string;
  usedAt: string | null;
}

export default function RedeemCodesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');

  // 筛选参数
  const status = searchParams.get('status') || '';
  const productCode = searchParams.get('productCode') || '';
  const memberType = searchParams.get('memberType') || '';
  const batchId = searchParams.get('batchId') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

  const memberTypes = productCode ? getMemberTypes(productCode) : [];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (productCode) params.set('productCode', productCode);
      if (memberType) params.set('memberType', memberType);
      if (batchId) params.set('batchId', batchId);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', '30');

      const res = await fetch(`/api/admin/redeem-codes/list?${params}`);
      const data = await res.json();
      if (data.code === 0) {
        setCodes(data.data.items);
        setTotal(data.data.total);
      }
    } catch {}
    setLoading(false);
  }, [status, productCode, memberType, batchId, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 构建筛选 URL
  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { status, productCode, memberType, batchId, search, ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/admin/redeem-codes?${params}`;
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (selectedIds.size === codes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(codes.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // 批量操作
  const handleBatchAction = async (action: 'disable' | 'delete') => {
    if (selectedIds.size === 0) return;
    const label = action === 'disable' ? '禁用' : '删除';
    if (!confirm(`确定${label}选中的 ${selectedIds.size} 张卡密？`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/redeem-codes/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setSelectedIds(new Set());
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('操作失败');
    }
    setActionLoading(false);
  };

  // 导出：弹窗显示卡密文本
  const handleExport = () => {
    const codeTexts = codes.map((c) => c.code).join('\n');
    setExportText(codeTexts);
    setShowExport(true);
  };

  const handleCopyExport = async () => {
    await navigator.clipboard.writeText(exportText);
    alert('已复制全部卡密');
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">卡密列表</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
            导出
          </button>
        </div>
      </div>

      {/* 状态 Tab */}
      <div className="mb-4 flex gap-1 border-b">
        {[
          { key: '', label: '全部' },
          { key: 'available', label: '可用' },
          { key: 'consumed', label: '已使用' },
          { key: 'disabled', label: '已禁用' },
        ].map((tab) => (
          <a
            key={tab.key}
            href={buildUrl({ status: tab.key, page: '' })}
            className={`px-4 py-2 text-sm ${status === tab.key ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* 筛选条件 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {/* 产品筛选 */}
        {PRODUCT_TYPES.map((p) => (
          <a
            key={p.code}
            href={buildUrl({ productCode: productCode === p.code ? '' : p.code, memberType: '', page: '' })}
            className={`rounded-full px-3 py-1 text-xs ${productCode === p.code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {p.label}
          </a>
        ))}

        {/* 会员类型筛选（选了产品后显示） */}
        {productCode && memberTypes.length > 0 && (
          <>
            <span className="text-xs text-gray-400 leading-6">|</span>
            {memberTypes.map((m) => (
              <a
                key={m.code}
                href={buildUrl({ memberType: memberType === m.code ? '' : m.code, page: '' })}
                className={`rounded-full px-3 py-1 text-xs ${memberType === m.code ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {m.label}
              </a>
            ))}
          </>
        )}

        {(productCode || memberType) && (
          <a href="/admin/redeem-codes" className="rounded-full px-3 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200">
            清除筛选
          </a>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2">
          <span className="text-sm text-blue-700">已选 {selectedIds.size} 项</span>
          <button
            onClick={() => handleBatchAction('disable')}
            disabled={actionLoading}
            className="rounded bg-orange-500 px-3 py-1 text-xs text-white hover:bg-orange-600 disabled:opacity-50"
          >
            批量禁用
          </button>
          <button
            onClick={() => handleBatchAction('delete')}
            disabled={actionLoading}
            className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
          >
            批量删除
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
            取消选择
          </button>
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={selectedIds.size === codes.length && codes.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left">卡密</th>
              <th className="px-3 py-2 text-left">产品/会员</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">批次</th>
              <th className="px-3 py-2 text-left">创建时间</th>
              <th className="px-3 py-2 text-left">使用时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
            ) : (
              codes.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2">{getProductMemberLabel(c.productCode, c.memberType)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.batchId}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.usedAt ? new Date(c.usedAt).toLocaleString('zh-CN') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > 30 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <a href={buildUrl({ page: String(page - 1) })} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">上一页</a>}
          <span className="px-3 py-1 text-sm text-gray-500">第 {page} 页，共 {Math.ceil(total / 30)} 页</span>
          {page * 30 < total && <a href={buildUrl({ page: String(page + 1) })} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">下一页</a>}
        </div>
      )}

      {/* 导出弹窗 */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExport(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">导出卡密（{codes.length} 张）</h3>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea
              readOnly
              value={exportText}
              rows={12}
              className="w-full rounded-lg border bg-gray-50 p-3 font-mono text-sm"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCopyExport}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                一键复制全部
              </button>
              <button
                onClick={() => setShowExport(false)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
