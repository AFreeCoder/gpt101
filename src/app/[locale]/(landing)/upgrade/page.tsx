'use client';

import { useState } from 'react';
import { getProductMemberLabel, getMemberLabel } from '@/shared/lib/redeem-code';

export default function UpgradePage() {
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
  const [errorStep, setErrorStep] = useState<number>(0); // 错误出现在哪一步
  const [codeVerified, setCodeVerified] = useState(false);
  const [tokenParsed, setTokenParsed] = useState(false);
  const [taskNo, setTaskNo] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskMessage, setTaskMessage] = useState('');
  const [polling, setPolling] = useState(false);

  const productLabel = getProductMemberLabel(productCode, memberType);

  const handleVerifyCode = async () => {
    setError(''); setErrorStep(0);
    setLoading('code');
    try {
      const res = await fetch('/api/upgrade/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); setErrorStep(1); return; }
      setProductCode(data.data.productCode);
      setMemberType(data.data.memberType || '');
      setCodeVerified(true);
    } catch { setError('网络错误，请重试'); setErrorStep(1); }
    finally { setLoading(''); }
  };

  const handleParseToken = async () => {
    setError(''); setErrorStep(0);
    setLoading('token');

    // 前端预校验 JSON 格式
    const trimmed = sessionToken.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const missing = [];
        if (!parsed.user?.id) missing.push('user.id');
        if (!parsed.user?.email) missing.push('user.email');
        if (!parsed.account?.id) missing.push('account.id');
        if (!parsed.account?.planType) missing.push('account.planType');
        if (!parsed.accessToken) missing.push('accessToken');
        if (missing.length > 0) {
          setError(`Token 格式不完整，缺少字段：${missing.join('、')}`);
          setErrorStep(2);
          setLoading('');
          return;
        }
      } catch {
        setError('Token 格式错误，请粘贴完整的 JSON 内容');
        setErrorStep(2);
        setLoading('');
        return;
      }
    }

    try {
      const res = await fetch('/api/upgrade/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: trimmed }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); setErrorStep(2); return; }

      // 只有 free 用户才能升级 Plus
      if (data.data.currentPlan && data.data.currentPlan !== 'free') {
        setError(`当前账号为 ${data.data.currentPlan} 会员，请等会员到期后再进行充值升级`);
        setErrorStep(2);
        return;
      }

      setAccountEmail(data.data.email);
      setAccountId(data.data.accountId);
      setCurrentPlan(data.data.currentPlan || '');
      setAccessToken(data.data.accessToken || trimmed);
      setTokenParsed(true);
    } catch { setError('网络错误，请重试'); setErrorStep(2); }
    finally { setLoading(''); }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading('submit');
    try {
      const res = await fetch('/api/upgrade/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          sessionToken: sessionToken.trim(),
          chatgptEmail: accountEmail,
          chatgptAccountId: accountId,
          chatgptCurrentPlan: currentPlan,
        }),
      });
      const data = await res.json();
      if (data.code !== 0) { setError(data.message); setErrorStep(3); return; }
      setTaskNo(data.data.taskNo);
      setTaskStatus('pending');
      setTaskMessage('升级任务已提交，正在排队处理...');
      fetch('/api/upgrade/worker', { method: 'POST' }).catch(() => {});
      setPolling(true);
      pollStatus(data.data.taskNo);
    } catch { setError('网络错误，请重试'); setErrorStep(3); }
    finally { setLoading(''); }
  };

  const pollStatus = async (no: string) => {
    let count = 0;
    const poll = async () => {
      if (count >= 60) { setTaskMessage('处理中，请稍后刷新页面'); setPolling(false); return; }
      try {
        const res = await fetch(`/api/upgrade/task/${no}`);
        const data = await res.json();
        if (data.code === 0) {
          setTaskStatus(data.data.status);
          setTaskMessage(data.data.message);
          if (['succeeded', 'failed', 'canceled'].includes(data.data.status)) { setPolling(false); return; }
        }
      } catch {}
      count++;
      setTimeout(poll, 2000);
    };
    poll();
  };

  const currentStep = taskNo ? 4 : tokenParsed ? 3 : codeVerified ? 2 : 1;

  return (
    <div className="relative min-h-[80vh]">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        {/* 标题区 */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            自助升级服务
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            GPT 会员升级
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            全自动处理，通常 1-2 分钟完成升级
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* 左侧：主操作区 */}
          <div className="min-w-0 flex-1">
            <div className="space-y-1">
              {/* Step 1 */}
              <div className={`rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${currentStep === 1 ? 'border-primary/30 bg-card shadow-md' : codeVerified ? 'border-border/50 bg-card/60' : 'border-border/30 bg-muted/30'}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${codeVerified ? 'bg-emerald-500 text-white' : currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {codeVerified ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : '1'}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">核验卡密</h2>
                    <p className="text-xs text-muted-foreground">输入购买获得的升级卡密</p>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); if (codeVerified) { setCodeVerified(false); setTokenParsed(false); } }}
                    placeholder="请输入卡密"
                    disabled={!!taskNo}
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading === 'code' || code.trim().length < 10 || codeVerified || !!taskNo}
                    className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {loading === 'code' ? (
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />验证中</span>
                    ) : codeVerified ? '已验证' : '立即核验'}
                  </button>
                </div>

                {error && errorStep === 1 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    {error}
                  </div>
                )}
                {codeVerified && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    卡密有效
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div className={`rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${!codeVerified ? 'pointer-events-none opacity-40 border-border/20 bg-muted/20' : currentStep === 2 ? 'border-primary/30 bg-card shadow-md' : tokenParsed ? 'border-border/50 bg-card/60' : 'border-border/30 bg-card/80'}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${tokenParsed ? 'bg-emerald-500 text-white' : currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {tokenParsed ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : '2'}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">核验 Token</h2>
                    <p className="text-xs text-muted-foreground">粘贴您的 ChatGPT Session Token</p>
                  </div>
                </div>

                {/* Token 获取教程 */}
                <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground/80">如何获取 Token：</p>
                  <ol className="list-inside list-decimal space-y-0.5">
                    <li>登录 ChatGPT 官网：<a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">chatgpt.com</a></li>
                    <li>打开 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">chatgpt.com/api/auth/session</a>，复制页面全部内容</li>
                  </ol>
                </div>

                <textarea
                  value={sessionToken}
                  onChange={(e) => { setSessionToken(e.target.value); if (tokenParsed) setTokenParsed(false); }}
                  placeholder="粘贴完整的 Session Token（JSON 格式）"
                  rows={3}
                  disabled={!!taskNo}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleParseToken}
                    disabled={loading === 'token' || !sessionToken.trim() || tokenParsed || !!taskNo}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {loading === 'token' ? (
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />解析中</span>
                    ) : tokenParsed ? '已验证' : '核验 Token'}
                  </button>
                </div>

                {error && errorStep === 2 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    {error}
                  </div>
                )}
                {tokenParsed && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Token 验证通过
                  </div>
                )}
              </div>

              {/* Step 3: 确认 & 结果 */}
              <div className={`rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${!tokenParsed ? 'pointer-events-none opacity-40 border-border/20 bg-muted/20' : taskNo ? (taskStatus === 'succeeded' ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md' : taskStatus === 'failed' ? 'border-destructive/30 bg-destructive/5 shadow-md' : 'border-primary/30 bg-card shadow-md') : 'border-primary/30 bg-card shadow-md'}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${taskStatus === 'succeeded' ? 'bg-emerald-500 text-white' : taskStatus === 'failed' ? 'bg-destructive text-white' : currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {taskStatus === 'succeeded' ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : taskStatus === 'failed' ? '!' : '3'}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{taskNo ? '升级结果' : '确认升级'}</h2>
                    <p className="text-xs text-muted-foreground">{taskNo ? `任务编号：${taskNo}` : '核对信息后确认提交'}</p>
                  </div>
                </div>

                {/* 确认信息（未提交时） */}
                {!taskNo && tokenParsed && (
                  <>
                    <div className="mb-4 divide-y divide-border/50 rounded-xl border border-border/50 bg-muted/30">
                      {[
                        ['ChatGPT 账号', accountEmail],
                        ['升级会员', getMemberLabel(productCode, memberType)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                    {error && errorStep === 3 && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        {error}
                      </div>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={loading === 'submit'}
                      className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                      {loading === 'submit' ? (
                        <span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />提交中...</span>
                      ) : '确认升级'}
                    </button>
                  </>
                )}

                {/* 升级结果 */}
                {taskNo && (
                  <div className="py-2 text-center">
                    {polling ? (
                      <div className="flex flex-col items-center gap-4 py-2">
                        <div className="relative h-12 w-12">
                          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                          <div className="absolute inset-2 animate-spin rounded-full border-[2px] border-primary/10 border-b-primary/50" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-primary">{taskMessage}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">一般充值预计 10 分钟左右，请耐心等待</p>
                        </div>
                      </div>
                    ) : taskStatus === 'succeeded' ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                          <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{taskMessage}</p>
                        <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md">
                          前往 ChatGPT
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </a>
                      </div>
                    ) : taskStatus === 'failed' ? (
                      <div className="flex flex-col items-center gap-4 py-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">充值遇到一点小问题，无需担心</p>
                          <p className="mt-1 text-xs text-muted-foreground">请联系客服协助处理，我们会尽快为您解决</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                          <span className="text-sm text-muted-foreground">客服微信：</span>
                          <span className="text-sm font-semibold text-foreground">AFreeCoder01</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{taskMessage}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：信息面板 */}
          <div className="w-full shrink-0 space-y-4 lg:w-72">
            {/* 流程指引 */}
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">充值流程</h3>
              <div className="space-y-5">
                {[
                  { n: '01', title: '核验卡密', desc: '粘贴卡密并核验，系统自动判定是否可用。' },
                  { n: '02', title: '核验 Token', desc: '输入 Token 确认账号信息和充值条件。' },
                  { n: '03', title: '确认升级', desc: '确认后自动处理，实时查看升级进度。' },
                ].map((s, i) => (
                  <div key={s.n} className="flex gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${currentStep > i + 1 ? 'bg-emerald-500 text-white' : currentStep === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {currentStep > i + 1 ? '✓' : s.n}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${currentStep >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/70">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 安全保障 */}
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="space-y-3">
                {[
                  { icon: '🔒', text: '数据加密传输' },
                  { icon: '⚡', text: '通常 1-2 分钟完成' },
                  { icon: '🛡️', text: '失败自动退还卡密' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="text-base">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* 客服 */}
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <p className="text-xs text-muted-foreground">遇到问题？联系客服</p>
              <p className="mt-1 text-sm font-semibold text-foreground">微信：AFreeCoder01</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
