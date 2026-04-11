'use client';

import { useState } from 'react';
import { PRODUCT_TYPES, getMemberTypes } from '@/shared/lib/redeem-code';

export default function GenerateRedeemCodesPage() {
  const [productCode, setProductCode] = useState('');
  const [memberType, setMemberType] = useState('');
  const [count, setCount] = useState(10);
  const [unitPrice, setUnitPrice] = useState('179.00');
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultCodes, setResultCodes] = useState<string[]>([]);
  const [resultTitle, setResultTitle] = useState('');
  const [error, setError] = useState('');

  const memberTypes = productCode ? getMemberTypes(productCode) : [];

  const handleGenerate = async () => {
    setError('');

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
      setResultCodes(data.data.codes);
      setResultTitle(data.data.title);
      setShowResult(true);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(resultCodes.join('\n'));
    alert('已复制全部卡密');
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-lg font-semibold">批量生成卡密</h2>

      {error && (
        <div className="mb-4 max-w-xl rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

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

      {/* 生成结果弹窗 */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowResult(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-700">✓ 生成成功</h3>
                <p className="text-sm text-gray-500">批次: {resultTitle}，共 {resultCodes.length} 张</p>
              </div>
              <button onClick={() => setShowResult(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea
              readOnly
              value={resultCodes.join('\n')}
              rows={12}
              className="w-full rounded-lg border bg-gray-50 p-3 font-mono text-sm"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCopyAll}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                一键复制全部
              </button>
              <button
                onClick={() => setShowResult(false)}
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
