'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';

import {
  UpgradeTaskSummary,
  type UpgradeTaskSummaryData,
} from '@/shared/blocks/upgrade/upgrade-task-summary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  getAdPlusFunnelConversionAction,
  getUpgradeAttributionFromHref,
  hasAdPlusUpgradeEntryFromLanding,
  resolveAdPlusSourceFromHref,
  trackAdPlusFunnelStep,
} from '@/shared/lib/ad-funnel';
import type { UpgradeNoticeConfig } from '@/shared/lib/content-config';
import {
  sendGoogleAdsConversionAction,
  sendGtagEvent,
} from '@/shared/lib/gtag';
import {
  getMemberLabel,
  getProductMemberLabel,
} from '@/shared/lib/redeem-code';
import { isOutlookEmail } from '@/shared/lib/upgrade-email-warning';

export type UpgradeFlowProps = {
  showSupportCard?: boolean;
  supportContact?: string | null;
  supportContactLabel?: string;
  submitErrorMessage?: string;
  failedHelpText?: string;
  safetyIssueText?: string;
  noticeConfig?: UpgradeNoticeConfig | null;
  /** 'default' = /upgrade 现状（不可改动）；'channel' = /channel-upgrade D3 琥珀金 */
  variant?: 'default' | 'channel';
};

const MEMBERSHIP_REFRESH_HINT =
  '如未生效，登录 ChatGPT 账号后，点击升级 Plus 即可触发状态更新';

export function UpgradeFlow({
  showSupportCard = true,
  supportContact = 'AFreeCoder01',
  supportContactLabel = '微信',
  submitErrorMessage = '充值异常，请联系客服处理',
  failedHelpText,
  safetyIssueText = '异常联系客服处理',
  noticeConfig = null,
  variant = 'default',
}: UpgradeFlowProps = {}) {
  const isChannel = variant === 'channel';
  // channel 语义色（避开站点蓝/绿/紫；成功=深金、警告=赤褐、错误走 --destructive 红）。
  // default 值保持现状，保证 /upgrade 逐字不变。
  const doneBadge = isChannel
    ? 'bg-[#B45309] text-white'
    : 'bg-emerald-500 text-white';
  const successPill = isChannel
    ? 'bg-[#FBF1DC] text-[#8A5A12]'
    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  const successBtn = isChannel
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'bg-emerald-600 text-white hover:bg-emerald-700';
  const successCard = isChannel
    ? 'border-[#E7C98F] bg-[#FCF6E8]'
    : 'border-emerald-500/30 bg-emerald-50/50';
  const successIconWrap = isChannel ? 'bg-[#FBF1DC]' : 'bg-emerald-500/10';
  const successIconColor = isChannel ? 'text-[#B45309]' : 'text-emerald-600';
  const successTitle = isChannel
    ? 'text-[#8A5A12]'
    : 'text-emerald-700 dark:text-emerald-400';
  const successSubtle = isChannel
    ? 'text-[#8A6A2E]'
    : 'text-emerald-700/80 dark:text-emerald-300/80';
  const warnBox = isChannel
    ? 'border-[#F0DBCB] bg-[#FBF3EC]'
    : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10';
  const warnTitle = isChannel
    ? 'text-[#9A3412]'
    : 'text-amber-800 dark:text-amber-300';
  const warnSub = isChannel
    ? 'text-[#9A3412]/85'
    : 'text-sky-700 dark:text-sky-300';
  const btnSpinner = isChannel
    ? 'border-[#7a4a08]/40 border-t-[#7a4a08]'
    : 'border-white/30 border-t-white';

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
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const [noticeScrollHintVisible, setNoticeScrollHintVisible] = useState(false);
  const noticeBodyRef = useRef<HTMLDivElement | null>(null);
  const [redeemCodeTask, setRedeemCodeTask] =
    useState<UpgradeTaskSummaryData | null>(null);

  const productLabel = getProductMemberLabel(productCode, memberType);
  const shouldShowOutlookEmailWarning =
    tokenParsed && isOutlookEmail(accountEmail);
  const canConfirmUpgrade = tokenParsed && !isOutlookEmail(accountEmail);
  const shouldShowNotice = !!noticeConfig?.enabled && !noticeAcknowledged;

  const updateNoticeScrollHint = useCallback(() => {
    const body = noticeBodyRef.current;

    if (!body || !shouldShowNotice) {
      setNoticeScrollHintVisible(false);
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = body;
    const hasOverflow = scrollHeight > clientHeight + 4;
    const hasReachedBottom = scrollTop + clientHeight >= scrollHeight - 4;

    setNoticeScrollHintVisible(hasOverflow && !hasReachedBottom);
  }, [shouldShowNotice]);

  useEffect(() => {
    if (!shouldShowNotice) {
      setNoticeScrollHintVisible(false);
      return;
    }

    const frameId = window.requestAnimationFrame(updateNoticeScrollHint);
    window.addEventListener('resize', updateNoticeScrollHint);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateNoticeScrollHint);
    };
  }, [noticeConfig, shouldShowNotice, updateNoticeScrollHint]);

  const trackAdPlusStep = (step: 'verify_code' | 'verify_token') => {
    const source =
      typeof window === 'undefined'
        ? null
        : resolveAdPlusSourceFromHref(window.location.href);

    if (!hasAdPlusUpgradeEntryFromLanding()) {
      return;
    }

    trackAdPlusFunnelStep(source, step, {
      sendEvent: sendGtagEvent,
      sendConversion: (params) => {
        sendGoogleAdsConversionAction(
          getAdPlusFunnelConversionAction(step),
          undefined,
          params
        );
      },
    });
  };

  const resetAll = () => {
    setCode('');
    setSessionToken('');
    setProductCode('');
    setMemberType('');
    setAccountEmail('');
    setAccountId('');
    setCurrentPlan('');
    setAccessToken('');
    setCodeVerified(false);
    setTokenParsed(false);
    setTaskNo('');
    setTaskStatus('');
    setTaskMessage('');
    setPolling(false);
    setRedeemCodeTask(null);
    setError('');
    setErrorStep(0);
    setLoading('');
  };

  const handleNoticeAck = () => {
    setNoticeAcknowledged(true);
    sendGtagEvent('upgrade_notice_ack', {
      notice_title: noticeConfig?.title || '',
    });
  };

  const handleVerifyCode = async () => {
    setError('');
    setErrorStep(0);
    setLoading('code');
    try {
      const res = await fetch('/api/upgrade/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(data.message);
        setErrorStep(1);
        return;
      }

      if (data.data.task) {
        setProductCode(data.data.productCode || data.data.task.productCode);
        setMemberType(data.data.memberType || data.data.task.memberType || '');
        setRedeemCodeTask(data.data.task);
        setCodeVerified(false);
        setTokenParsed(false);
        return;
      }

      setRedeemCodeTask(null);
      setProductCode(data.data.productCode);
      setMemberType(data.data.memberType || '');
      setCodeVerified(true);
    } catch {
      setError('网络错误，请重试');
      setErrorStep(1);
    } finally {
      setLoading('');
    }
  };

  const handleParseToken = async () => {
    setError('');
    setErrorStep(0);
    setLoading('token');

    // 前端预校验 JSON 格式
    const trimmed = sessionToken.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const missing = [];
        if (!parsed.user?.id) missing.push('user.id');
        if (!parsed.user?.email) missing.push('user.email');
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
      if (data.code !== 0) {
        setError(data.message);
        setErrorStep(2);
        return;
      }

      // 只有 free 用户才能升级 Plus
      if (data.data.currentPlan && data.data.currentPlan !== 'free') {
        setError(
          `当前账号为 ${data.data.currentPlan} 会员，请等会员到期后再进行充值升级`
        );
        setErrorStep(2);
        return;
      }

      setAccountEmail(data.data.email);
      setAccountId(data.data.accountId);
      setCurrentPlan(data.data.currentPlan || '');
      setAccessToken(data.data.accessToken || trimmed);
      setTokenParsed(true);
    } catch {
      setError('网络错误，请重试');
      setErrorStep(2);
    } finally {
      setLoading('');
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (isOutlookEmail(accountEmail)) {
      setError('请将 ChatGPT 账号邮箱更换为 gmail、QQ 等其他邮箱后再继续升级');
      setErrorStep(2);
      return;
    }

    setLoading('submit');
    const attribution =
      typeof window === 'undefined'
        ? {}
        : getUpgradeAttributionFromHref(window.location.href);

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
          ...attribution,
        }),
      });
      const data = await res.json();
      if (data.code !== 0) {
        setError(submitErrorMessage);
        setErrorStep(3);
        return;
      }
      setTaskNo(data.data.taskNo);
      setTaskStatus('pending');
      setTaskMessage('升级任务已提交，正在排队处理...');
      setPolling(true);
      pollStatus(data.data.taskNo);
    } catch {
      setError('网络错误，请重试');
      setErrorStep(3);
    } finally {
      setLoading('');
    }
  };

  const pollStatus = async (no: string) => {
    let count = 0;
    const poll = async () => {
      if (count >= 60) {
        setTaskMessage('处理中，请稍后刷新页面');
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
      setTimeout(poll, 2000);
    };
    poll();
  };

  const currentStep = taskNo ? 4 : canConfirmUpgrade ? 3 : codeVerified ? 2 : 1;
  const redeemCodeTaskStatus = redeemCodeTask?.status || '';
  const redeemCodeTaskNotice =
    redeemCodeTaskStatus === 'succeeded'
      ? {
          title: '该卡密已使用，升级已成功',
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
          help: MEMBERSHIP_REFRESH_HINT,
        }
      : redeemCodeTaskStatus === 'pending' || redeemCodeTaskStatus === 'running'
        ? {
            title: '该卡密已有升级任务处理中',
            tone: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
            help: '系统正在处理这张卡密，请不要重复提交。',
          }
        : redeemCodeTaskStatus === 'failed'
          ? {
              title: redeemCodeTask?.manualRequired
                ? '该卡密已提交升级，当前充值异常待客服处理'
                : '该卡密已提交升级，请联系客服处理',
              tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
              help: supportContact
                ? `请联系客服协助处理 · ${supportContactLabel}：${supportContact}`
                : '请联系客服协助处理。',
            }
          : {
              title: '该卡密已提交升级',
              tone: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
              help: '请核对下方任务信息。',
            };

  return (
    <div className="relative min-h-[80vh]">
      {noticeConfig?.enabled && (
        <Dialog open={shouldShowNotice}>
          <DialogContent
            showCloseButton={false}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
            className={`flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] ${isChannel ? 'channel-skin' : ''}`}
          >
            <div
              className={`shrink-0 border-b px-6 py-5 ${isChannel ? 'bg-[#FBF1DC] text-[#5A4A2E]' : 'bg-amber-50 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100'}`}
            >
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {noticeConfig.title}
                </DialogTitle>
                <DialogDescription
                  className={
                    isChannel
                      ? 'text-[#8A6A2E]'
                      : 'text-amber-900/80 dark:text-amber-100/75'
                  }
                >
                  {noticeConfig.description}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={noticeBodyRef}
                onScroll={updateNoticeScrollHint}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
              >
                <ul className="space-y-3">
                  {noticeConfig.items.map((item, idx) => (
                    <li key={item} className="flex gap-3 text-sm leading-6">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${isChannel ? 'bg-[#FBF1DC] text-[#8A5A12]' : 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100'}`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                {noticeConfig.footer && (
                  <p className="text-muted-foreground border-t pt-4 text-sm leading-6">
                    {noticeConfig.footer}
                  </p>
                )}
              </div>
              {noticeScrollHintVisible && (
                <div className="from-background via-background/95 pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t to-transparent px-6 pt-10 pb-3">
                  <div className="border-border/70 bg-background/95 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm">
                    <ChevronUp
                      aria-hidden="true"
                      className="h-3.5 w-3.5 motion-safe:animate-bounce"
                    />
                    上滑查看更多注意事项
                  </div>
                </div>
              )}
            </div>
            <div className="bg-background/95 shrink-0 border-t px-6 py-4">
              <button
                type="button"
                onClick={handleNoticeAck}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-colors ${successBtn} ${isChannel ? 'channel-lift' : ''}`}
              >
                {noticeConfig.buttonText || '我已了解，继续升级'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* 背景装饰：default 紫色光晕；channel 由 .channel-skin 提供金色光晕 */}
      {!isChannel && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-primary/5 absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl" />
          <div className="bg-primary/5 absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl" />
        </div>
      )}

      <div
        className={`relative mx-auto px-4 py-10 sm:px-6 sm:py-16 ${isChannel ? 'channel-stage max-w-2xl' : 'max-w-5xl'}`}
      >
        {/* 标题区 */}
        {isChannel ? (
          <div className="mb-8 text-center">
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              GPT Plus 自助升级
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              全自动处理，通常 1-2 分钟完成升级
            </p>
          </div>
        ) : (
          <div className="mb-10 text-center">
            <div className="border-primary/20 bg-primary/5 text-primary mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              自助升级服务
            </div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              GPT 会员升级
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              全自动处理，通常 1-2 分钟完成升级
            </p>
          </div>
        )}

        {/* 邮箱风险提示：channel 不显示（Step2 检测到 outlook 邮箱时另有提示）*/}
        {!isChannel && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">邮箱风险提示</p>
            <p className="mt-1">
              因官方风控问题，GPT 账号为 outlook 或 hotmail 邮箱的用户，
              需要更换为 gmail、QQ 等其他邮箱。
            </p>
            <p className={`mt-1 ${warnSub}`}>
              更换步骤：网页登录
              ChatGPT，点击【头像—设置—账户—电子邮件】，进行修改。
            </p>
          </div>
        )}

        {isChannel && (
          <div className="mb-6 flex items-center px-1">
            {[
              { n: 1, label: '核验卡密' },
              { n: 2, label: '核验 Token' },
              { n: 3, label: '确认升级' },
            ].map((s, i) => (
              <div key={s.n} className="contents">
                {i > 0 && (
                  <div
                    className={`mb-[22px] h-0.5 flex-1 rounded ${currentStep > i ? 'bg-primary' : 'bg-border'}`}
                  />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      currentStep > s.n
                        ? doneBadge
                        : currentStep === s.n
                          ? 'bg-primary text-primary-foreground channel-pulse'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > s.n ? '✓' : s.n}
                  </div>
                  <span
                    className={`text-xs font-medium ${currentStep >= s.n ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`flex flex-col gap-8 ${isChannel ? '' : 'lg:flex-row'}`}>
          {/* 左侧：主操作区 */}
          <div className="min-w-0 flex-1">
            <div className="space-y-1">
              {/* Step 1 */}
              <div
                className={`rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${currentStep === 1 ? 'border-primary/30 bg-card shadow-md' : codeVerified ? 'border-border/50 bg-card/60' : 'border-border/30 bg-muted/30'}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${codeVerified ? doneBadge : currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {codeVerified ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      '1'
                    )}
                  </div>
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">
                      核验卡密
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      输入购买获得的升级卡密
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setRedeemCodeTask(null);
                      if (codeVerified) {
                        setCodeVerified(false);
                        setTokenParsed(false);
                      }
                    }}
                    placeholder="请输入卡密"
                    disabled={!!taskNo && taskStatus !== 'failed'}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-ring/20 min-w-0 flex-1 rounded-xl border px-4 py-2.5 font-mono text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      trackAdPlusStep('verify_code');
                      void handleVerifyCode();
                    }}
                    disabled={
                      loading === 'code' ||
                      code.trim().length < 10 ||
                      codeVerified ||
                      !!taskNo
                    }
                    className={`bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${isChannel ? 'channel-lift' : ''}`}
                  >
                    {loading === 'code' ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${btnSpinner}`}
                        />
                        验证中
                      </span>
                    ) : codeVerified ? (
                      '已验证'
                    ) : (
                      '立即核验'
                    )}
                  </button>
                </div>

                {error && errorStep === 1 && (
                  <div className="bg-destructive/10 text-destructive mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {error}
                  </div>
                )}
                {redeemCodeTask && (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-3 text-sm ${redeemCodeTaskNotice.tone}`}
                  >
                    <p className="font-semibold">
                      {redeemCodeTaskNotice.title}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      {redeemCodeTaskNotice.help}
                    </p>
                    <div className="mt-3">
                      <UpgradeTaskSummary task={redeemCodeTask} />
                    </div>
                  </div>
                )}
                {codeVerified && (
                  <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${successPill} ${isChannel ? 'channel-popin' : ''}`}>
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    卡密有效
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${!codeVerified ? 'border-border/20 bg-muted/20 pointer-events-none opacity-40' : currentStep === 2 || taskStatus === 'failed' ? 'border-primary/30 bg-card shadow-md' : tokenParsed ? 'border-border/50 bg-card/60' : 'border-border/30 bg-card/80'}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${tokenParsed ? doneBadge : currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {tokenParsed ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      '2'
                    )}
                  </div>
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">
                      核验 Token
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      粘贴您的 ChatGPT Session Token
                    </p>
                  </div>
                </div>

                {/* Token 获取教程 */}
                <div className="bg-muted/50 text-muted-foreground mb-3 rounded-lg px-3 py-2.5 text-xs">
                  <p className="text-foreground/80 mb-1 font-medium">
                    如何获取 Token：
                  </p>
                  <ol className="list-inside list-decimal space-y-0.5">
                    <li>
                      登录 ChatGPT 官网：
                      <a
                        href="https://chatgpt.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        chatgpt.com
                      </a>
                    </li>
                    <li>
                      打开{' '}
                      <a
                        href="https://chatgpt.com/api/auth/session"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        chatgpt.com/api/auth/session
                      </a>
                      ，复制页面全部内容
                    </li>
                  </ol>
                </div>

                <textarea
                  value={sessionToken}
                  onChange={(e) => {
                    setSessionToken(e.target.value);
                    if (tokenParsed) setTokenParsed(false);
                  }}
                  placeholder="粘贴完整的 Session Token（JSON 格式）"
                  rows={3}
                  disabled={!!taskNo && taskStatus !== 'failed'}
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-ring/20 w-full rounded-xl border px-4 py-2.5 font-mono text-xs leading-relaxed focus:ring-2 focus:outline-none disabled:opacity-50"
                />

                <div className="mt-3 flex justify-between">
                  {tokenParsed ? (
                    <button
                      onClick={() => {
                        setTokenParsed(false);
                        setTaskNo('');
                        setTaskStatus('');
                        setTaskMessage('');
                      }}
                      className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl border px-4 py-2.5 text-sm"
                    >
                      返回修改
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setCodeVerified(false);
                        setSessionToken('');
                      }}
                      className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl border px-4 py-2.5 text-sm"
                    >
                      上一步
                    </button>
                  )}
                  <button
                    onClick={() => {
                      trackAdPlusStep('verify_token');
                      void handleParseToken();
                    }}
                    disabled={
                      loading === 'token' ||
                      !sessionToken.trim() ||
                      tokenParsed ||
                      !!taskNo
                    }
                    className={`bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${isChannel ? 'channel-lift' : ''}`}
                  >
                    {loading === 'token' ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${btnSpinner}`}
                        />
                        解析中
                      </span>
                    ) : tokenParsed ? (
                      '已验证'
                    ) : (
                      '核验 Token'
                    )}
                  </button>
                </div>

                {error && errorStep === 2 && (
                  <div className="bg-destructive/10 text-destructive mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {error}
                  </div>
                )}
                {tokenParsed && (
                  <>
                    <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${successPill} ${isChannel ? 'channel-popin' : ''}`}>
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      Token 验证通过
                    </div>
                    {shouldShowOutlookEmailWarning && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${warnBox}`}
                      >
                        <p className={`font-medium ${warnTitle}`}>
                          因官方风控问题，outlook / hotmail
                          邮箱账号存在封号风险，请修改。
                        </p>
                        <p className={`mt-1 ${warnSub}`}>
                          {
                            '更换步骤：网页登录 ChatGPT，点击【头像—设置—账户—电子邮件】，进行修改。'
                          }
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 3: 确认升级（样式固定不变） */}
              <div
                className={`rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${!canConfirmUpgrade ? 'border-border/20 bg-muted/20 pointer-events-none opacity-40' : currentStep === 3 ? 'border-primary/30 bg-card shadow-md' : 'border-border/50 bg-card/60'}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-colors ${taskNo ? doneBadge : currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {taskNo ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      '3'
                    )}
                  </div>
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">
                      确认升级
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      核对信息后确认提交
                    </p>
                  </div>
                </div>

                {/* 确认信息 */}
                {tokenParsed && (
                  <div className="divide-border/50 border-border/50 bg-muted/30 mb-4 divide-y rounded-xl border">
                    {[
                      ['ChatGPT 账号', accountEmail],
                      ['升级会员', getMemberLabel(productCode, memberType)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-foreground font-medium">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 提交/重试按钮 */}
                {tokenParsed && (!taskNo || taskStatus === 'failed') && (
                  <>
                    {error && errorStep === 3 && (
                      <div className="bg-destructive/10 text-destructive mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                        <svg
                          className="h-4 w-4 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {error}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTokenParsed(false);
                          setTaskNo('');
                          setTaskStatus('');
                          setTaskMessage('');
                          setError('');
                          setErrorStep(0);
                        }}
                        className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl border px-4 py-3 text-sm"
                      >
                        上一步
                      </button>
                      <button
                        onClick={() => {
                          setTaskNo('');
                          setTaskStatus('');
                          setTaskMessage('');
                          setError('');
                          setErrorStep(0);
                          handleSubmit();
                        }}
                        disabled={loading === 'submit' || !canConfirmUpgrade}
                        className={`flex-1 rounded-xl py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${successBtn} ${isChannel ? 'channel-lift' : ''}`}
                      >
                        {loading === 'submit' ? (
                          <span className="flex items-center justify-center gap-2">
                            <span
                              className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${btnSpinner}`}
                            />
                            提交中...
                          </span>
                        ) : taskStatus === 'failed' ? (
                          '重试升级'
                        ) : (
                          '确认升级'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* 升级结果（独立卡片，在 Step 3 下方） */}
              {taskNo && (
                <div
                  className={`rounded-2xl border p-4 ${taskStatus === 'succeeded' ? successCard : 'border-border/50 bg-card'}`}
                >
                  {polling ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="relative h-12 w-12">
                        <div className="border-primary/20 border-t-primary absolute inset-0 animate-spin rounded-full border-[3px]" />
                        <div
                          className="border-primary/10 border-b-primary/50 absolute inset-2 animate-spin rounded-full border-[2px]"
                          style={{
                            animationDirection: 'reverse',
                            animationDuration: '1.5s',
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-primary text-sm font-medium">
                          {taskMessage}
                        </p>
                        <p className="text-muted-foreground mt-1.5 text-xs">
                          一般充值预计 10 分钟左右，请耐心等待
                        </p>
                      </div>
                    </div>
                  ) : taskStatus === 'succeeded' ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${successIconWrap} ${isChannel ? 'channel-popin' : ''}`}
                      >
                        <svg
                          className={`h-7 w-7 ${successIconColor}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className={`text-lg font-bold ${successTitle}`}>
                        {taskMessage}
                      </p>
                      <p className={`max-w-md text-center text-sm ${successSubtle}`}>
                        {MEMBERSHIP_REFRESH_HINT}
                      </p>
                      <div className="flex gap-3">
                        <a
                          href="https://chat.openai.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow-md ${successBtn} ${isChannel ? 'channel-lift' : ''}`}
                        >
                          前往 ChatGPT
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </a>
                        <button
                          onClick={resetAll}
                          className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl border px-5 py-2.5 text-sm"
                        >
                          继续升级
                        </button>
                      </div>
                    </div>
                  ) : taskStatus === 'failed' ? (
                    <div className="bg-destructive/5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
                      <svg
                        className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p className="text-destructive">
                          充值遇到一点小问题，无需担心
                        </p>
                        {failedHelpText ? (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {failedHelpText}
                          </p>
                        ) : supportContact ? (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            请联系客服协助处理 · {supportContactLabel}：
                            <span className="text-foreground font-medium">
                              {supportContact}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-4 text-sm">
                      {taskMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {isChannel && (
              <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  🔒 数据加密传输
                </span>
                <span className="inline-flex items-center gap-1.5">
                  ⚡ 通常 1-2 分钟完成
                </span>
                <span className="inline-flex items-center gap-1.5">
                  🛡️ {safetyIssueText}
                </span>
              </div>
            )}
          </div>

          {/* 右侧信息面板：channel 不渲染（信息已由顶部进度条 + 底部安全保障承载）*/}
          {!isChannel && (
            <div className="w-full shrink-0 space-y-4 lg:w-72">
            {/* 流程指引 */}
            <div className="border-border/50 bg-card rounded-2xl border p-6 shadow-sm">
              <h3 className="text-muted-foreground mb-5 text-sm font-bold tracking-wider uppercase">
                充值流程
              </h3>
              <div className="space-y-5">
                {[
                  {
                    n: '01',
                    title: '核验卡密',
                    desc: '粘贴卡密并核验，系统自动判定是否可用。',
                  },
                  {
                    n: '02',
                    title: '核验 Token',
                    desc: '输入 Token 确认账号信息和充值条件。',
                  },
                  {
                    n: '03',
                    title: '确认升级',
                    desc: '确认后自动处理，实时查看升级进度。',
                  },
                ].map((s, i) => (
                  <div key={s.n} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${currentStep > i + 1 ? 'bg-emerald-500 text-white' : currentStep === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {currentStep > i + 1 ? '✓' : s.n}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-medium ${currentStep >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {s.title}
                      </p>
                      <p className="text-muted-foreground/70 mt-0.5 text-xs leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 安全保障 */}
            <div className="border-border/50 bg-card rounded-2xl border p-5">
              <div className="space-y-3">
                {[
                  { icon: '🔒', text: '数据加密传输' },
                  { icon: '⚡', text: '通常 1-2 分钟完成' },
                  { icon: '🛡️', text: safetyIssueText },
                ].map((item) => (
                  <div
                    key={item.text}
                    className="text-muted-foreground flex items-center gap-2.5 text-sm"
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* 客服 */}
            {showSupportCard && supportContact && (
              <div className="border-border/50 bg-card rounded-2xl border p-5">
                <p className="text-muted-foreground text-xs">
                  遇到问题？联系客服
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold">
                  {supportContactLabel}：{supportContact}
                </p>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpgradeFlow;
