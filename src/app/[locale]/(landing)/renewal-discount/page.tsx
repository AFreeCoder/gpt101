'use client';

import { useState } from 'react';

export default function RenewalDiscountPage() {
  const [verifyValue, setVerifyValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setError('');
    setCouponCode('');
    setMessage('');

    if (!verifyValue.trim()) {
      setError('请输入订单号或卡密');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/renewal-discount/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifyValue: verifyValue.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }
      setCouponCode(data.data.couponCode);
      setMessage(data.data.message);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(couponCode);
      alert('优惠码已复制');
    } catch {
      // 降级
      const input = document.createElement('input');
      input.value = couponCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      alert('优惠码已复制');
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
        老用户续费优惠
      </h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        输入您上一次的订单号或卡密，验证通过后即可获得续费优惠码（减 10 元）
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          订单号或卡密
        </label>
        <input
          type="text"
          value={verifyValue}
          onChange={(e) => setVerifyValue(e.target.value)}
          placeholder="输入您之前的订单号或卡密"
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        {!couponCode && (
          <button
            onClick={handleVerify}
            disabled={loading || !verifyValue.trim()}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '验证中...' : '验证并获取优惠码'}
          </button>
        )}

        {couponCode && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-green-700">{message}</p>
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
              <span className="flex-1 text-center font-mono text-xl font-bold tracking-widest text-green-800">
                {couponCode}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                复制
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-gray-500">
              请在发卡网购买时输入此优惠码
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        遇到问题？请联系客服微信：
        <span className="font-medium text-gray-700">AFreeCoder01</span>
      </div>
    </div>
  );
}
