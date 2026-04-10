'use client';

import { useState } from 'react';

export default function GenerateRedeemCodesPage() {
  const [productCode, setProductCode] = useState('plus');
  const [count, setCount] = useState(10);
  const [unitPrice, setUnitPrice] = useState(17900);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    batchId: string;
    codes: string[];
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/redeem-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode, count, unitPrice, title }),
      });

      const data = await res.json();

      if (data.code !== 0) {
        setError(data.message || '生成失败');
      } else {
        setResult(data.data);
      }
    } catch (err: any) {
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyAll() {
    if (!result) return;
    navigator.clipboard.writeText(result.codes.join('\n'));
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <nav className="text-sm text-muted-foreground">
          <a href="/admin" className="hover:underline">管理后台</a>
          <span className="mx-2">/</span>
          <a href="/admin/redeem-codes" className="hover:underline">卡密列表</a>
          <span className="mx-2">/</span>
          <span className="text-foreground">批量生成</span>
        </nav>
      </div>

      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-bold">批量生成卡密</h1>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-6">
          {/* 产品类型 */}
          <div>
            <label className="mb-1 block text-sm font-medium">产品类型</label>
            <select
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="plus">Plus</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
            </select>
          </div>

          {/* 数量 */}
          <div>
            <label className="mb-1 block text-sm font-medium">生成数量</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 单价（分） */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              单价（分，1元=100分，默认 17900 即 179 元）
            </label>
            <input
              type="number"
              min={0}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              实际金额：{(unitPrice / 100).toFixed(2)} 元
            </p>
          </div>

          {/* 批次名称 */}
          <div>
            <label className="mb-1 block text-sm font-medium">批次名称</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：2026-04 Plus 批次"
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {error && (
            <div className="rounded bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '生成中...' : '生成卡密'}
          </button>
        </form>

        {/* 生成结果 */}
        {result && (
          <div className="mt-6 rounded-lg border p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                生成成功 —— 共 {result.codes.length} 张卡密
              </h2>
              <button
                onClick={handleCopyAll}
                className="rounded border px-3 py-1 text-sm hover:bg-muted"
              >
                复制全部
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              批次 ID：{result.batchId}
            </p>
            <textarea
              readOnly
              value={result.codes.join('\n')}
              rows={Math.min(result.codes.length + 2, 20)}
              className="w-full rounded border bg-muted/30 px-3 py-2 font-mono text-xs focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
