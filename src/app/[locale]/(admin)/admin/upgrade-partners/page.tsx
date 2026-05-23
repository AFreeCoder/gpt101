'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Pencil, Plus, RefreshCw, X } from 'lucide-react';

import { Header } from '@/shared/blocks/dashboard';
import { getProductMemberLabel, PRODUCT_TYPES } from '@/shared/lib/redeem-code';

interface PartnerAllowedProduct {
  productCode: string;
  memberType?: string;
}

interface PartnerApp {
  id: string;
  appKey: string;
  name: string;
  status: string;
  allowedProducts: PartnerAllowedProduct[];
  ipAllowlist: string[];
  rateLimitPerMinute: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'bg-green-50 text-green-700' },
  disabled: { label: '已禁用', color: 'bg-red-50 text-red-700' },
};

const defaultForm = {
  name: '',
  appKeyPrefix: 'partner',
  status: 'active',
  allowedProductKeys: [] as string[],
  ipAllowlist: '',
  rateLimitPerMinute: 120,
  note: '',
};

function productKey(productCode: string, memberType: string) {
  return `${productCode}:${memberType}`;
}

function allowedProductToKey(item: PartnerAllowedProduct) {
  return item.memberType ? productKey(item.productCode, item.memberType) : '';
}

function keyToAllowedProduct(key: string): PartnerAllowedProduct | null {
  const [productCode, memberType] = key.split(':');
  if (!productCode || !memberType) return null;
  return { productCode, memberType };
}

function formatDate(value: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export default function UpgradePartnersPage() {
  const [apps, setApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [secretResult, setSecretResult] = useState<{
    title: string;
    appKey: string;
    appSecret: string;
  } | null>(null);

  const productOptions = useMemo(
    () =>
      PRODUCT_TYPES.flatMap((product) =>
        product.members.map((member) => ({
          key: productKey(product.code, member.code),
          label: getProductMemberLabel(product.code, member.code),
        }))
      ),
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/upgrade-partners/list');
      const data = await res.json();
      if (data.code === 0) {
        setApps(data.data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (app: PartnerApp) => {
    setEditingId(app.id);
    setForm({
      name: app.name,
      appKeyPrefix: app.appKey,
      status: app.status,
      allowedProductKeys: app.allowedProducts
        .map(allowedProductToKey)
        .filter(Boolean),
      ipAllowlist: app.ipAllowlist.join('\n'),
      rateLimitPerMinute: app.rateLimitPerMinute,
      note: app.note || '',
    });
    setError('');
    setShowModal(true);
  };

  const toggleProduct = (key: string) => {
    setForm((prev) => ({
      ...prev,
      allowedProductKeys: prev.allowedProductKeys.includes(key)
        ? prev.allowedProductKeys.filter((item) => item !== key)
        : [...prev.allowedProductKeys, key],
    }));
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    appKeyPrefix: editingId ? undefined : form.appKeyPrefix.trim(),
    status: form.status,
    allowedProducts: form.allowedProductKeys
      .map(keyToAllowedProduct)
      .filter(Boolean),
    ipAllowlist: form.ipAllowlist
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
    rateLimitPerMinute: Number(form.rateLimitPerMinute) || 120,
    note: form.note.trim(),
  });

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('请输入接入方名称');
      return;
    }
    if (!editingId && !form.appKeyPrefix.trim()) {
      setError('请输入 appKey 前缀');
      return;
    }
    if (form.allowedProductKeys.length === 0) {
      setError('请选择允许售卖的商品');
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? '/api/admin/upgrade-partners/update'
        : '/api/admin/upgrade-partners/create';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...buildPayload(),
        }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }

      setShowModal(false);
      if (!editingId) {
        setSecretResult({
          title: '已创建接入方',
          appKey: data.data.app.appKey,
          appSecret: data.data.appSecret,
        });
      }
      fetchData();
    } catch {
      setError('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRotateSecret = async (app: PartnerApp) => {
    if (!confirm(`确定轮换「${app.name}」的 appSecret？旧密钥会立即失效。`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/upgrade-partners/rotate-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        alert(data.message);
        return;
      }

      setSecretResult({
        title: '已轮换密钥',
        appKey: data.data.app.appKey,
        appSecret: data.data.appSecret,
      });
      fetchData();
    } catch {
      alert('轮换失败');
    }
  };

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    alert('已复制');
  };

  return (
    <>
      <Header />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">第三方接入</h2>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="size-4" />
            新建接入方
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">名称</th>
                <th className="px-3 py-2 text-left">appKey</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">允许商品</th>
                <th className="px-3 py-2 text-left">IP 白名单</th>
                <th className="px-3 py-2 text-left">限流</th>
                <th className="px-3 py-2 text-left">更新时间</th>
                <th className="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    加载中...
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    暂无接入方
                  </td>
                </tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{app.name}</div>
                      {app.note && (
                        <div className="mt-1 max-w-64 truncate text-xs text-gray-400">
                          {app.note}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{app.appKey}</span>
                        <button
                          onClick={() => copyText(app.appKey)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="复制 appKey"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MAP[app.status]?.color || 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_MAP[app.status]?.label || app.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-72 text-xs text-gray-600">
                        {app.allowedProducts.length === 0
                          ? '-'
                          : app.allowedProducts
                              .map((item) =>
                                getProductMemberLabel(
                                  item.productCode,
                                  item.memberType || '*'
                                )
                              )
                              .join('、')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {app.ipAllowlist.length
                        ? app.ipAllowlist.join(', ')
                        : '-'}
                    </td>
                    <td className="px-3 py-2">{app.rateLimitPerMinute}/min</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatDate(app.updatedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(app)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Pencil className="size-3.5" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleRotateSecret(app)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          <RefreshCw className="size-3.5" />
                          轮换密钥
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowModal(false)}
            />
            <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingId ? '编辑接入方' : '新建接入方'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="size-4" />
                </button>
              </div>

              {error && (
                <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      接入方名称
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      appKey 前缀
                    </label>
                    <input
                      type="text"
                      value={form.appKeyPrefix}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          appKeyPrefix: event.target.value,
                        })
                      }
                      disabled={!!editingId}
                      className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      状态
                    </label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({ ...form, status: event.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="active">启用</option>
                      <option value="disabled">禁用</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      每分钟限流
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={form.rateLimitPerMinute}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          rateLimitPerMinute: Number(event.target.value) || 1,
                        })
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    允许售卖商品
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {productOptions.map((option) => (
                      <label
                        key={option.key}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.allowedProductKeys.includes(option.key)}
                          onChange={() => toggleProduct(option.key)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    IP 白名单
                  </label>
                  <textarea
                    value={form.ipAllowlist}
                    onChange={(event) =>
                      setForm({ ...form, ipAllowlist: event.target.value })
                    }
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">备注</label>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(event) =>
                      setForm({ ...form, note: event.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {secretResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSecretResult(null)}
            />
            <div className="relative z-10 w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{secretResult.title}</h3>
                <button
                  onClick={() => setSecretResult(null)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    appKey
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={secretResult.appKey}
                      className="min-w-0 flex-1 rounded-lg border bg-gray-50 px-3 py-2 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyText(secretResult.appKey)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Copy className="size-4" />
                      复制
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    appSecret
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={secretResult.appSecret}
                      className="min-w-0 flex-1 rounded-lg border bg-gray-50 px-3 py-2 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyText(secretResult.appSecret)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Copy className="size-4" />
                      复制
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSecretResult(null)}
                className="mt-5 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
