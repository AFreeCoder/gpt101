'use client';

import { useState, useEffect, useCallback } from 'react';

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
  availableCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChannelForm {
  code: string;
  name: string;
  driver: string;
  supportedProducts: string;
  status: string;
  priority: number;
  requiresCardkey: boolean;
  note: string;
}

const emptyForm: ChannelForm = {
  code: '',
  name: '',
  driver: '',
  supportedProducts: '',
  status: 'active',
  priority: 100,
  requiresCardkey: false,
  note: '',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'text-green-600 bg-green-50' },
  disabled: { label: '已禁用', color: 'text-red-600 bg-red-50' },
};

export default function UpgradeChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/upgrade-channels/list');
      const data = await res.json();
      if (data.code === 0) {
        setChannels(data.data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setForm({
      code: channel.code,
      name: channel.name,
      driver: channel.driver,
      supportedProducts: channel.supportedProducts,
      status: channel.status,
      priority: channel.priority,
      requiresCardkey: channel.requiresCardkey,
      note: channel.note || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.driver || !form.supportedProducts || !form.status) {
      alert('请填写必填字段');
      return;
    }
    if (!editingId && !form.code) {
      alert('请填写渠道代码');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId
        ? '/api/admin/upgrade-channels/update'
        : '/api/admin/upgrade-channels/create';

      const body = editingId
        ? {
            id: editingId,
            name: form.name,
            driver: form.driver,
            supportedProducts: form.supportedProducts,
            status: form.status,
            priority: form.priority,
            requiresCardkey: form.requiresCardkey,
            note: form.note,
          }
        : form;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.code === 0) {
        setShowModal(false);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('操作失败');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除渠道「${name}」？此操作不可恢复。`)) return;

    try {
      const res = await fetch('/api/admin/upgrade-channels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.code === 0) {
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('删除失败');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">升级渠道管理</h2>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          新建渠道
        </button>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">代码</th>
              <th className="px-3 py-2 text-left">驱动</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">优先级</th>
              <th className="px-3 py-2 text-left">需要卡密</th>
              <th className="px-3 py-2 text-left">库存数量</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            ) : channels.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              channels.map((ch) => {
                const st = STATUS_MAP[ch.status] || {
                  label: ch.status,
                  color: 'bg-gray-100 text-gray-600',
                };
                return (
                  <tr key={ch.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{ch.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{ch.code}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {ch.driver}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">{ch.priority}</td>
                    <td className="px-3 py-2">{ch.requiresCardkey ? '是' : '否'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          ch.requiresCardkey && ch.availableCount === 0
                            ? 'font-medium text-red-600'
                            : ''
                        }
                      >
                        {ch.requiresCardkey ? ch.availableCount : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(ch)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          编辑
                        </button>
                        <a
                          href={`/admin/upgrade-channels/${ch.id}/cardkeys`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          查看卡密
                        </a>
                        <button
                          onClick={() => handleDelete(ch.id, ch.name)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 弹窗表单 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editingId ? '编辑渠道' : '新建渠道'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">渠道名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="如：Mock渠道"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  渠道代码 *{editingId && ' (不可修改)'}
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingId}
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="如：mock"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">驱动 *</label>
                <input
                  type="text"
                  value={form.driver}
                  onChange={(e) => setForm({ ...form, driver: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="如：mock"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">支持产品 *</label>
                <input
                  type="text"
                  value={form.supportedProducts}
                  onChange={(e) =>
                    setForm({ ...form, supportedProducts: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="逗号分隔，如：gpt,claude"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">状态 *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="active">启用</option>
                    <option value="disabled">禁用</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">优先级</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requiresCardkey"
                  checked={form.requiresCardkey}
                  onChange={(e) =>
                    setForm({ ...form, requiresCardkey: e.target.checked })
                  }
                />
                <label htmlFor="requiresCardkey" className="text-sm">
                  是否需要卡密
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">备注</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="可选"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
