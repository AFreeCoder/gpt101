'use client';

import { useState, useEffect, useCallback } from 'react';
import { PRODUCT_TYPES } from '@/shared/lib/redeem-code';

interface Channel {
  id: string;
  code: string;
  name: string;
  driver: string;
  supportedProducts: string;
  status: string;
  priority: number;
  requiresCardkey: boolean;
  note: string | null;
  availableCount?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'text-green-600 bg-green-50' },
  disabled: { label: '已禁用', color: 'text-red-600 bg-red-50' },
};

const defaultForm = {
  code: '',
  name: '',
  supportedProducts: [] as string[],
  status: 'active',
  priority: 100,
  requiresCardkey: true,
  note: '',
};

export default function UpgradeChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/upgrade-channels/list');
      const data = await res.json();
      if (data.code === 0) setChannels(data.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (ch: Channel) => {
    setEditingId(ch.id);
    setForm({
      code: ch.code,
      name: ch.name,
      supportedProducts: ch.supportedProducts.split(',').map((s) => s.trim()).filter(Boolean),
      status: ch.status,
      priority: ch.priority,
      requiresCardkey: ch.requiresCardkey,
      note: ch.note || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    if (!form.name) { setError('请输入渠道名称'); return; }
    if (!form.code) { setError('请输入渠道代码'); return; }
    if (form.supportedProducts.length === 0) { setError('请选择支持的产品'); return; }

    setSaving(true);
    try {
      const url = editingId ? '/api/admin/upgrade-channels/update' : '/api/admin/upgrade-channels/create';
      const body = {
        ...(editingId ? { id: editingId } : {}),
        code: form.code,
        name: form.name,
        driver: form.code,
        supportedProducts: form.supportedProducts.join(','),
        status: form.status,
        priority: form.priority,
        requiresCardkey: form.requiresCardkey,
        note: form.note,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); return; }
      setShowModal(false);
      fetchData();
    } catch { setError('操作失败'); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除渠道"${name}"？`)) return;
    try {
      const res = await fetch('/api/admin/upgrade-channels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.code !== 0) { alert(data.message); return; }
      fetchData();
    } catch { alert('删除失败'); }
  };

  const toggleProduct = (code: string) => {
    setForm((prev) => ({
      ...prev,
      supportedProducts: prev.supportedProducts.includes(code)
        ? prev.supportedProducts.filter((p) => p !== code)
        : [...prev.supportedProducts, code],
    }));
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">渠道管理</h2>
        <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          新建渠道
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">代码</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">优先级</th>
              <th className="px-3 py-2 text-left">支持产品</th>
              <th className="px-3 py-2 text-left">需要卡密</th>
              <th className="px-3 py-2 text-left">库存</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">加载中...</td></tr>
            ) : channels.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">暂无渠道</td></tr>
            ) : (
              channels.map((ch) => (
                <tr key={ch.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{ch.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{ch.code}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[ch.status]?.color || ''}`}>
                      {STATUS_MAP[ch.status]?.label || ch.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{ch.priority}</td>
                  <td className="px-3 py-2 text-xs">
                    {ch.supportedProducts.split(',').map((p) => {
                      const pt = PRODUCT_TYPES.find((t) => t.code === p.trim());
                      return pt?.label || p.trim();
                    }).join(', ')}
                  </td>
                  <td className="px-3 py-2">{ch.requiresCardkey ? '是' : '否'}</td>
                  <td className="px-3 py-2">
                    <span className={ch.requiresCardkey && (ch.availableCount || 0) === 0 ? 'font-medium text-red-600' : ''}>
                      {ch.requiresCardkey ? (ch.availableCount ?? 0) : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(ch)} className="text-xs text-blue-600 hover:underline">编辑</button>
                      <button onClick={() => handleDelete(ch.id, ch.name)} className="text-xs text-red-600 hover:underline">删除</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">{editingId ? '编辑渠道' : '新建渠道'}</h3>

            {error && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">渠道名称</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：987AI" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">渠道代码{editingId && <span className="text-gray-400">（不可修改）</span>}</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingId} placeholder="如：987ai" className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">支持的产品</label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_TYPES.map((p) => (
                    <label key={p.code} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={form.supportedProducts.includes(p.code)}
                        onChange={() => toggleProduct(p.code)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">状态</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="active">启用</option>
                    <option value="disabled">禁用</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">优先级<span className="text-gray-400 text-xs ml-1">（越小越优先）</span></label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requiresCardkey} onChange={(e) => setForm({ ...form, requiresCardkey: e.target.checked })} />
                需要渠道卡密
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium">备注</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
