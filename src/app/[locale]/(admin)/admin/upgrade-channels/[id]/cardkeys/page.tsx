'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  PRODUCT_TYPES,
  getMemberTypes,
  getProductMemberLabel,
} from '@/shared/lib/redeem-code';

interface Cardkey {
  id: string;
  channelId: string;
  cardkey: string;
  productCode: string;
  memberType: string;
  status: string;
  usedAt: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: '可用', color: 'text-green-600 bg-green-50' },
  locked: { label: '锁定', color: 'text-yellow-600 bg-yellow-50' },
  used: { label: '已使用', color: 'text-gray-500 bg-gray-100' },
  disabled: { label: '已禁用', color: 'text-red-600 bg-red-50' },
};

export default function ChannelCardkeysPage() {
  const params = useParams();
  const channelId = params.id as string;

  const [cardkeys, setCardkeys] = useState<Cardkey[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelName, setChannelName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // 筛选
  const [filterProduct, setFilterProduct] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 新增卡密表单
  const [showImport, setShowImport] = useState(false);
  const [importProduct, setImportProduct] = useState('');
  const [importMember, setImportMember] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const memberTypes = filterProduct ? getMemberTypes(filterProduct) : [];
  const importMemberTypes = importProduct ? getMemberTypes(importProduct) : [];

  // 获取渠道名称
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/upgrade-channels/list');
        const data = await res.json();
        if (data.code === 0) {
          const ch = data.data.find((c: any) => c.id === channelId);
          if (ch) setChannelName(ch.name);
        }
      } catch {}
    })();
  }, [channelId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('channelId', channelId);
      if (filterProduct) params.set('productCode', filterProduct);
      if (filterMember) params.set('memberType', filterMember);
      if (filterStatus) params.set('status', filterStatus);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/admin/channel-cardkeys/list?${params}`);
      const data = await res.json();
      if (data.code === 0) {
        setCardkeys(data.data.items);
        setTotal(data.data.total);
      }
    } catch {}
    setLoading(false);
  }, [channelId, filterProduct, filterMember, filterStatus, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 切换筛选时重置页码
  const applyFilter = (overrides: {
    product?: string;
    member?: string;
    status?: string;
  }) => {
    if (overrides.product !== undefined) {
      setFilterProduct(overrides.product);
      setFilterMember('');
    }
    if (overrides.member !== undefined) setFilterMember(overrides.member);
    if (overrides.status !== undefined) setFilterStatus(overrides.status);
    setPage(1);
    setSelectedIds(new Set());
  };

  // 全选/取消
  const toggleAll = () => {
    if (selectedIds.size === cardkeys.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cardkeys.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // 可以删除的条件：available 或 disabled
  const canDelete = (status: string) =>
    status === 'available' || status === 'disabled';

  // 批量删除
  const handleBatchDelete = async () => {
    const deletableIds = Array.from(selectedIds).filter((id) => {
      const ck = cardkeys.find((c) => c.id === id);
      return ck && canDelete(ck.status);
    });

    if (deletableIds.length === 0) {
      alert('没有可删除的卡密（仅可用和已禁用状态的卡密可以删除）');
      return;
    }

    if (
      !confirm(
        `确定删除选中的 ${deletableIds.length} 张卡密？此操作不可恢复。`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/channel-cardkeys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setSelectedIds(new Set());
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('删除失败');
    }
    setActionLoading(false);
  };

  // 导入卡密
  const handleImport = async () => {
    if (!importProduct || !importMember) {
      alert('请选择产品类型和会员类型');
      return;
    }
    const lines = importText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) {
      alert('请输入卡密');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/admin/channel-cardkeys/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          productCode: importProduct,
          memberType: importMember,
          cardkeys: lines,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        alert(
          `导入成功：${data.data.importedCount} 张，跳过：${data.data.skippedCount} 张`
        );
        setShowImport(false);
        setImportText('');
        setImportProduct('');
        setImportMember('');
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('导入失败');
    }
    setImporting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="mb-2">
        <a
          href="/admin/upgrade-channels"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; 返回渠道列表
        </a>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {channelName ? `${channelName} - 卡密管理` : '卡密管理'}
        </h2>
        <button
          onClick={() => setShowImport(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          新增卡密
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="mb-4 flex gap-1 border-b">
        {[
          { key: '', label: '全部' },
          { key: 'available', label: '可用' },
          { key: 'locked', label: '锁定' },
          { key: 'used', label: '已使用' },
          { key: 'disabled', label: '已禁用' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => applyFilter({ status: tab.key })}
            className={`px-4 py-2 text-sm ${
              filterStatus === tab.key
                ? 'border-b-2 border-blue-600 font-medium text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 产品/会员筛选 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRODUCT_TYPES.map((p) => (
          <button
            key={p.code}
            onClick={() =>
              applyFilter({
                product: filterProduct === p.code ? '' : p.code,
              })
            }
            className={`rounded-full px-3 py-1 text-xs ${
              filterProduct === p.code
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}

        {filterProduct && memberTypes.length > 0 && (
          <>
            <span className="text-xs leading-6 text-gray-400">|</span>
            {memberTypes.map((m) => (
              <button
                key={m.code}
                onClick={() =>
                  applyFilter({
                    member: filterMember === m.code ? '' : m.code,
                  })
                }
                className={`rounded-full px-3 py-1 text-xs ${
                  filterMember === m.code
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </>
        )}

        {(filterProduct || filterMember) && (
          <button
            onClick={() => applyFilter({ product: '', member: '' })}
            className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-600 hover:bg-red-200"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 批量操作 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2">
          <span className="text-sm text-blue-700">
            已选 {selectedIds.size} 项
          </span>
          <button
            onClick={handleBatchDelete}
            disabled={actionLoading}
            className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
          >
            批量删除
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
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
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === cardkeys.length && cardkeys.length > 0
                  }
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left">卡密</th>
              <th className="px-3 py-2 text-left">产品/会员</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">创建时间</th>
              <th className="px-3 py-2 text-left">使用时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  加载中...
                </td>
              </tr>
            ) : cardkeys.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  暂无数据
                </td>
              </tr>
            ) : (
              cardkeys.map((ck) => {
                const st = STATUS_MAP[ck.status] || {
                  label: ck.status,
                  color: 'bg-gray-100 text-gray-600',
                };
                return (
                  <tr key={ck.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ck.id)}
                        onChange={() => toggleOne(ck.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{ck.cardkey}</td>
                    <td className="px-3 py-2">
                      {getProductMemberLabel(ck.productCode, ck.memberType)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(ck.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {ck.usedAt
                        ? new Date(ck.usedAt).toLocaleString('zh-CN')
                        : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <button
              onClick={() => {
                setPage(page - 1);
                setSelectedIds(new Set());
              }}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            >
              上一页
            </button>
          )}
          <span className="px-3 py-1 text-sm text-gray-500">
            第 {page} 页，共 {totalPages} 页
          </span>
          {page < totalPages && (
            <button
              onClick={() => {
                setPage(page + 1);
                setSelectedIds(new Set());
              }}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            >
              下一页
            </button>
          )}
        </div>
      )}

      {/* 导入卡密弹窗 */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">新增卡密</h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  产品类型 *
                </label>
                <select
                  value={importProduct}
                  onChange={(e) => {
                    setImportProduct(e.target.value);
                    setImportMember('');
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">请选择</option>
                  {PRODUCT_TYPES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  会员类型 *
                </label>
                <select
                  value={importMember}
                  onChange={(e) => setImportMember(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  disabled={!importProduct}
                >
                  <option value="">请选择</option>
                  {importMemberTypes.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  卡密（每行一个）*
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  placeholder="每行粘贴一个卡密"
                />
                {importText && (
                  <p className="mt-1 text-xs text-gray-500">
                    共{' '}
                    {
                      importText
                        .split('\n')
                        .map((l) => l.trim())
                        .filter((l) => l).length
                    }{' '}
                    行
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
