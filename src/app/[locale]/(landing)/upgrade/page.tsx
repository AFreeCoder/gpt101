'use client';

import { useState } from 'react';
import { getProductMemberLabel } from '@/shared/lib/redeem-code';

export default function UpgradePage() {
  // 状态
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [productCode, setProductCode] = useState('');
  const [memberType, setMemberType] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [currentPlan, setCurrentPlan] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  // 步骤完成状态
  const [codeVerified, setCodeVerified] = useState(false);
  const [tokenParsed, setTokenParsed] = useState(false);

  // 任务结果
  const [taskNo, setTaskNo] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskMessage, setTaskMessage] = useState('');
  const [polling, setPolling] = useState(false);

  const productLabel = getProductMemberLabel(productCode, memberType);

  // Step 1: 验证卡密
  const handleVerifyCode = async () => {
    setError('');
    setLoading('code');
    try {
      const res = await fetch('/api/upgrade/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); return; }
      setProductCode(data.data.productCode);
      setMemberType(data.data.memberType || '');
      setCodeVerified(true);
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(''); }
  };

  // Step 2: 解析 token
  const handleParseToken = async () => {
    setError('');
    setLoading('token');
    try {
      const res = await fetch('/api/upgrade/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: sessionToken.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); return; }
      setAccountEmail(data.data.email);
      setAccountId(data.data.accountId);
      setCurrentPlan(data.data.currentPlan || '');
      setAccessToken(data.data.accessToken || sessionToken.trim());
      setTokenParsed(true);
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(''); }
  };

  // Step 3: 提交升级
  const handleSubmit = async () => {
    setError('');
    setLoading('submit');
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
        }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); return; }

      setTaskNo(data.data.taskNo);
      setTaskStatus('pending');
      setTaskMessage('升级任务已提交，正在排队处理...');

      // 触发 worker
      fetch('/api/upgrade/worker', { method: 'POST' }).catch(() => {});

      // 开始轮询
      setPolling(true);
      pollStatus(data.data.taskNo);
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(''); }
  };

  // 轮询状态
  const pollStatus = async (no: string) => {
    let count = 0;
    const maxCount = 60;
    const interval = 2000;

    const poll = async () => {
      if (count >= maxCount) {
        setTaskMessage('升级处理中，请稍后刷新页面查看结果');
        setPolling(false);
        return;
      }
      try {
        const res = await fetch(`/api/upgrade/task/${no}`);
        const data = await res.json();
        if (data.code === 0) {
          setTaskStatus(data.data.status);
          setTaskMessage(data.data.message);
          if (['succeeded', 'failed', 'canceled'].includes(data.data.status)) {
            setPolling(false);
            return;
          }
        }
      } catch {}
      count++;
      setTimeout(poll, interval);
    };
    poll();
  };

  const statusIcon: Record<string, string> = {
    pending: '⏳',
    running: '⚙️',
    succeeded: '✅',
    failed: '❌',
    canceled: '🚫',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
        GPT 自助升级
      </h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        安全、快捷的自助升级服务
      </p>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左侧：操作区 */}
        <div className="flex-1 space-y-6">

          {/* Step 1: 卡密验证 */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${codeVerified ? 'bg-green-500' : 'bg-blue-600'}`}>
                {codeVerified ? '✓' : '1'}
              </span>
              <h2 className="font-semibold text-gray-900">核验卡密</h2>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); if (codeVerified) { setCodeVerified(false); setTokenParsed(false); } }}
                placeholder="请输入卡密"
                disabled={!!taskNo}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
              <button
                onClick={handleVerifyCode}
                disabled={loading === 'code' || code.trim().length < 10 || codeVerified || !!taskNo}
                className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === 'code' ? '验证中...' : codeVerified ? '已验证' : '立即核验'}
              </button>
            </div>

            {codeVerified && (
              <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                ✓ 卡密验证通过，产品：{productLabel}
              </div>
            )}
          </div>

          {/* Step 2: Token 验证（卡密验证通过后展开） */}
          {codeVerified && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${tokenParsed ? 'bg-green-500' : 'bg-blue-600'}`}>
                  {tokenParsed ? '✓' : '2'}
                </span>
                <h2 className="font-semibold text-gray-900">核验 Token</h2>
              </div>

              <p className="mb-2 text-xs text-gray-500">
                请粘贴您的 ChatGPT Session Token。
                <a
                  href="https://chat.openai.com/api/auth/session"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline"
                >
                  点击这里获取 Token →
                </a>
              </p>

              <div className="flex gap-3">
                <textarea
                  value={sessionToken}
                  onChange={(e) => { setSessionToken(e.target.value); if (tokenParsed) setTokenParsed(false); }}
                  placeholder='粘贴完整的 Session Token 内容（JSON 格式或纯 Access Token）'
                  rows={3}
                  disabled={!!taskNo}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                />
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleParseToken}
                  disabled={loading === 'token' || !sessionToken.trim() || tokenParsed || !!taskNo}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === 'token' ? '解析中...' : tokenParsed ? '已验证' : '核验 Token'}
                </button>
              </div>

              {tokenParsed && (
                <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  ✓ 账号：{accountEmail}
                  {currentPlan && <span className="ml-2">（当前：{currentPlan}）</span>}
                </div>
              )}
            </div>
          )}

          {/* Step 3: 确认升级（token 验证通过后展开）*/}
          {tokenParsed && !taskNo && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                <h2 className="font-semibold text-gray-900">确认升级</h2>
              </div>

              <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">升级产品</span>
                  <span className="font-medium">{productLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ChatGPT 账号</span>
                  <span className="font-medium">{accountEmail}</span>
                </div>
                {currentPlan && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">当前会员</span>
                    <span className="font-medium">{currentPlan}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading === 'submit'}
                className="w-full rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {loading === 'submit' ? '提交中...' : '确认升级'}
              </button>
            </div>
          )}

          {/* 升级结果（提交后展开）*/}
          {taskNo && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${taskStatus === 'succeeded' ? 'bg-green-500' : taskStatus === 'failed' ? 'bg-red-500' : 'bg-blue-600'}`}>
                  {taskStatus === 'succeeded' ? '✓' : '3'}
                </span>
                <h2 className="font-semibold text-gray-900">升级结果</h2>
              </div>

              <div className="text-center py-4">
                <span className="text-4xl">{statusIcon[taskStatus] || '⏳'}</span>
                <p className={`mt-3 text-lg font-semibold ${taskStatus === 'succeeded' ? 'text-green-600' : taskStatus === 'failed' ? 'text-red-600' : 'text-blue-600'}`}>
                  {taskMessage}
                </p>
                <p className="mt-2 text-xs text-gray-400">任务编号：{taskNo}</p>
              </div>

              {polling && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  正在查询最新状态...
                </div>
              )}

              {taskStatus === 'succeeded' && (
                <div className="mt-4 text-center">
                  <a
                    href="https://chat.openai.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    前往 ChatGPT →
                  </a>
                </div>
              )}

              {taskStatus === 'failed' && (
                <p className="mt-4 text-center text-sm text-gray-500">
                  请联系客服微信：<span className="font-medium text-gray-700">AFreeCoder01</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* 右侧：流程说明 */}
        <div className="w-full lg:w-72">
          <div className="rounded-xl bg-gray-900 p-6 text-white shadow-lg">
            <h3 className="mb-4 font-semibold">充值流程</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">1</span>
                <div>
                  <p className="font-medium">提交卡密</p>
                  <p className="mt-0.5 text-xs text-gray-400">粘贴卡密并点击核验，系统会自动判定是否可用。</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">2</span>
                <div>
                  <p className="font-medium">核验 Token</p>
                  <p className="mt-0.5 text-xs text-gray-400">输入 Token 后调用接口确认是否满足充值条件。</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">3</span>
                <div>
                  <p className="font-medium">实时更新状态</p>
                  <p className="mt-0.5 text-xs text-gray-400">实时查看升级进度，后台会自动处理，随时可查看结果。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-gray-500">
            <p>遇到问题？联系客服微信：</p>
            <p className="mt-1 font-medium text-gray-700">AFreeCoder01</p>
          </div>
        </div>
      </div>
    </div>
  );
}
