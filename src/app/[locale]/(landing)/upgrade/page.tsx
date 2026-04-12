'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source') || '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [productCode, setProductCode] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [currentPlan, setCurrentPlan] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: 验证卡密
  const handleVerifyCode = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/upgrade/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }
      setProductCode(data.data.productCode);
      setStep(2);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 解析 session token
  const handleResolveAccount = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/upgrade/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: sessionToken.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }
      setAccountEmail(data.data.email);
      setAccountId(data.data.accountId);
      setCurrentPlan(data.data.currentPlan || '');
      setAccessToken(data.data.accessToken || sessionToken.trim());
      setStep(3);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: 确认并提交
  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/upgrade/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          sessionToken: accessToken,
          chatgptEmail: accountEmail,
          chatgptAccountId: accountId,
          chatgptCurrentPlan: currentPlan,
          source,
          utm_source: searchParams.get('utm_source') || '',
          utm_medium: searchParams.get('utm_medium') || '',
          utm_campaign: searchParams.get('utm_campaign') || '',
        }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        return;
      }

      // 提交后立即触发一次 worker
      fetch('/api/upgrade/worker', { method: 'POST' }).catch(() => {});

      // 跳转到状态页
      router.push(`/upgrade/status/${data.data.taskNo}`);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const productLabels: Record<string, string> = {
    plus: 'ChatGPT Plus',
    pro: 'ChatGPT Pro',
    team: 'ChatGPT Team',
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">
        GPT 升级
      </h1>

      {/* 步骤指示器 */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1: 输入卡密 */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">输入卡密</h2>
          <p className="mb-4 text-sm text-gray-500">
            请输入您购买的升级卡密
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="请输入卡密"
            className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            maxLength={39}
          />
          <button
            onClick={handleVerifyCode}
            disabled={loading || code.trim().length < 10}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '验证中...' : '验证卡密'}
          </button>
        </div>
      )}

      {/* Step 2: 输入 session token */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            ✓ 卡密验证通过，产品：{productLabels[productCode] || productCode}
          </div>
          <h2 className="mb-4 text-lg font-semibold">输入 Session Token</h2>
          <p className="mb-4 text-sm text-gray-500">
            请输入您的 ChatGPT session token，用于确认升级账户
          </p>
          <textarea
            value={sessionToken}
            onChange={(e) => setSessionToken(e.target.value)}
            placeholder="粘贴您的 session token..."
            rows={4}
            className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              上一步
            </button>
            <button
              onClick={handleResolveAccount}
              disabled={loading || !sessionToken.trim()}
              className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '解析中...' : '解析账号'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 确认升级 */}
      {step === 3 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">确认升级信息</h2>
          <div className="mb-6 space-y-3 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">升级产品</span>
              <span className="font-medium">
                {productLabels[productCode] || productCode}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ChatGPT 账号</span>
              <span className="font-medium">{accountEmail}</span>
            </div>
            {currentPlan && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">当前会员</span>
                <span className="font-medium">{currentPlan}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">卡密</span>
              <span className="font-mono text-xs">{code}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              上一步
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '提交中...' : '确认升级'}
            </button>
          </div>
        </div>
      )}

      {/* 帮助信息 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        遇到问题？请联系客服微信：
        <span className="font-medium text-gray-700">AFreeCoder01</span>
      </div>
    </div>
  );
}
