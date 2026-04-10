'use client';

import { useState, useCallback } from 'react';

export default function InvoicePage() {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [buyerType, setBuyerType] = useState('company');
  const [buyerName, setBuyerName] = useState('');
  const [buyerTaxId, setBuyerTaxId] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerBank, setBuyerBank] = useState('');
  const [buyerBankAccount, setBuyerBankAccount] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // 邮箱输入后加载历史
  const loadHistory = useCallback(async (email: string) => {
    if (!email || historyLoaded) return;
    try {
      const res = await fetch(`/api/invoice/history?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.code === 0 && data.data) {
        const h = data.data;
        if (h.buyerType) setBuyerType(h.buyerType);
        if (h.buyerName) setBuyerName(h.buyerName);
        if (h.buyerTaxId) setBuyerTaxId(h.buyerTaxId);
        if (h.buyerAddress) setBuyerAddress(h.buyerAddress);
        if (h.buyerPhone) setBuyerPhone(h.buyerPhone);
        if (h.buyerBank) setBuyerBank(h.buyerBank);
        if (h.buyerBankAccount) setBuyerBankAccount(h.buyerBankAccount);
        setHistoryLoaded(true);
      }
    } catch {}
  }, [historyLoaded]);

  const handleSubmit = async () => {
    setError('');
    if (!recipientEmail) { setError('请输入接收发票的邮箱'); return; }
    if (!buyerName) { setError('请输入发票抬头'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/invoice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          buyerType,
          buyerName,
          buyerTaxId,
          buyerAddress,
          buyerPhone,
          buyerBank,
          buyerBankAccount,
          invoiceType: 'vat_normal',
          invoiceItem: 'GPT 充值服务',
          invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <span className="text-4xl">✅</span>
          <h2 className="mt-4 text-xl font-bold text-green-800">提交成功</h2>
          <p className="mt-2 text-sm text-green-700">
            发票将在 1-3 个工作日内开具并发送到您的邮箱：
            <br />
            <span className="font-medium">{recipientEmail}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
        发票申请
      </h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        请填写发票信息，我们将在 1-3 个工作日内开具并发送到您的邮箱
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* 邮箱 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            接收发票的邮箱 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            onBlur={(e) => loadHistory(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 发票类型 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            发票类型
          </label>
          <div className="flex gap-4">
            {[
              { value: 'company', label: '企业' },
              { value: 'personal', label: '个人' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="buyerType"
                  value={opt.value}
                  checked={buyerType === opt.value}
                  onChange={(e) => setBuyerType(e.target.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 发票抬头 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            发票抬头 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder={buyerType === 'company' ? '公司全称' : '个人姓名'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 税号（企业） */}
        {buyerType === 'company' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              纳税人识别号
            </label>
            <input
              type="text"
              value={buyerTaxId}
              onChange={(e) => setBuyerTaxId(e.target.value)}
              placeholder="统一社会信用代码"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}

        {/* 金额 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            开票金额（元）
          </label>
          <input
            type="number"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            placeholder="如 179"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 企业额外信息（可选） */}
        {buyerType === 'company' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                公司地址（选填）
              </label>
              <input
                type="text"
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                电话（选填）
              </label>
              <input
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                开户银行（选填）
              </label>
              <input
                type="text"
                value={buyerBank}
                onChange={(e) => setBuyerBank(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                银行账号（选填）
              </label>
              <input
                type="text"
                value={buyerBankAccount}
                onChange={(e) => setBuyerBankAccount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '提交中...' : '提交发票申请'}
        </button>
      </div>
    </div>
  );
}
