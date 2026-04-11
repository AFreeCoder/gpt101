'use client';

import { useState } from 'react';
import { PRODUCT_TYPES, getMemberTypes } from '@/shared/lib/redeem-code';

export default function GenerateRedeemCodesPage() {
  const [productCode, setProductCode] = useState('');
  const [memberType, setMemberType] = useState('');
  const [count, setCount] = useState(10);
  const [unitPrice, setUnitPrice] = useState('179.00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ batchId: string; title: string; codes: string[] } | null>(null);
  const [error, setError] = useState('');

  const memberTypes = productCode ? getMemberTypes(productCode) : [];

  const handleGenerate = async () => {
    setError('');
    setResult(null);

    if (!productCode) { setError('请选择产品类型'); return; }
    if (!memberType) { setError('请选择会员类型'); return; }
    if (count < 1 || count > 5000) { setError('数量范围 1-5000'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/redeem-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode, memberType, count, unitPrice }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }
      setResult(data.data);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.codes.join('\n'));
    alert('已复制全部卡密');
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-lg font-semibold">批量生成卡密</h2>

      {error && (
        <div className="mb-4 max-w-xl rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {!result ? (
        <div className="max-w-xl space-y-4 rounded-xl border bg-card p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">产品类型</label>
            <select
              value={productCode}
              onChange={(e) => { setProductCode(e.target.value); setMemberType(''); }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">请选择</option>
              {PRODUCT_TYPES.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">会员类型</label>
            <select
              value={memberType}
              onChange={(e) => setMemberType(e.target.value)}
              disabled={!productCode}
              className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">请选择</option>
              {memberTypes.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">数量</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 0)}
              min={1}
              max={5000}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">单价（元）</label>
            <input
              type="text"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="179.00"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '生成中...' : `生成 ${count} 张卡密`}
          </button>
        </div>
      ) : (
        <div className="max-w-xl rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-green-700">✓ 生成成功</h2>
              <p className="text-sm text-gray-500">
                批次: {result.title}，共 {result.codes.length} 张
              </p>
            </div>
            <button
              onClick={handleCopyAll}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              复制全部
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4">
            <pre className="text-sm font-mono">
              {result.codes.join('\n')}
            </pre>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-4 w-full rounded-lg border py-2 text-sm hover:bg-gray-50"
          >
            继续生成
          </button>
        </div>
      )}
    </div>
  );
}
