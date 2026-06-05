'use client';

import { useState } from 'react';
import { CheckCircle2, MessageCircle, Search, XCircle } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import {
  UpgradeTaskSummary,
  type UpgradeTaskSummaryData,
} from '@/shared/blocks/upgrade/upgrade-task-summary';
import { getProductMemberLabel } from '@/shared/lib/redeem-code';

type QueryResult = {
  valid?: boolean;
  productCode?: string;
  memberType?: string;
  task?: UpgradeTaskSummaryData;
};

function getCopy(locale: string) {
  const isZh = locale === 'zh';

  return {
    title: isZh ? '卡密状态查询' : 'Card status query',
    description: isZh
      ? '输入单个 GPT101 卡密，查看卡密是否可用，或查询已提交升级任务的处理结果。'
      : 'Enter one GPT101 card code to check availability or submitted upgrade status.',
    placeholder: isZh ? '粘贴完整卡密' : 'Paste full card code',
    button: isZh ? '查询状态' : 'Check status',
    loading: isZh ? '查询中...' : 'Checking...',
    availableTitle: isZh ? '卡密可用' : 'Card code is available',
    availableDescription: isZh
      ? '这张卡密尚未使用，可以回到升级页面继续提交。'
      : 'This card code is unused. You can continue on the upgrade page.',
    taskTitle: isZh ? '已找到升级记录' : 'Upgrade record found',
    taskDescription: isZh
      ? '这张卡密已经提交过升级任务，当前状态如下。'
      : 'This card code has a submitted upgrade task. Current status is below.',
    errorTitle: isZh ? '暂时无法查询' : 'Unable to query',
    supportText: isZh
      ? '如果查询结果和实际情况不一致，请联系客服并提供卡密。'
      : 'If the result does not match your situation, contact support with your card code.',
    upgrade: isZh ? '前往升级页面' : 'Go to upgrade page',
    contact: isZh ? '联系客服' : 'Contact support',
  };
}

export function QueryClient({ locale }: { locale: string }) {
  const copy = getCopy(locale);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);

  const handleQuery = async () => {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/upgrade/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (data.code !== 0) {
        setError(data.message || copy.errorTitle);
        return;
      }

      setResult(data.data || {});
    } catch {
      setError(locale === 'zh' ? '网络错误，请重试' : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const productLabel =
    result?.productCode && result?.memberType
      ? getProductMemberLabel(result.productCode, result.memberType)
      : '';

  return (
    <main className="bg-background min-h-screen">
      <section className="border-border/70 bg-muted/30 border-b">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
          <div className="max-w-2xl">
            <div className="border-primary/20 text-primary bg-background mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Search className="h-3.5 w-3.5" />
              QUERY
            </div>
            <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
              {copy.title}
            </h1>
            <p className="text-muted-foreground mt-4 text-base leading-7 md:text-lg">
              {copy.description}
            </p>
          </div>

          <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && code.trim() && !loading) {
                  handleQuery();
                }
              }}
              placeholder={copy.placeholder}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary h-12 min-w-0 flex-1 rounded-lg border px-4 text-sm shadow-sm transition-colors outline-none"
            />
            <button
              type="button"
              disabled={!code.trim() || loading}
              onClick={handleQuery}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {loading ? copy.loading : copy.button}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
        {error && (
          <div className="border-destructive/25 bg-destructive/5 rounded-lg border p-6">
            <div className="flex gap-3">
              <XCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-foreground font-semibold">
                  {copy.errorTitle}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {result?.task && (
          <div className="border-border bg-background rounded-lg border p-6 shadow-sm">
            <div className="mb-5 flex gap-3">
              <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-foreground font-semibold">
                  {copy.taskTitle}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {copy.taskDescription}
                </p>
              </div>
            </div>
            <UpgradeTaskSummary task={result.task} />
          </div>
        )}

        {result?.valid && !result.task && (
          <div className="border-primary/25 bg-primary/5 rounded-lg border p-6">
            <div className="flex gap-3">
              <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-foreground font-semibold">
                  {copy.availableTitle}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {copy.availableDescription}
                  {productLabel ? ` ${productLabel}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/upgrade"
            className="border-border hover:bg-muted inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition-colors"
          >
            {copy.upgrade}
          </Link>
          <Link
            href="/#customer-support"
            className="border-border hover:bg-muted inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {copy.contact}
          </Link>
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-6">
          {copy.supportText}
        </p>
      </section>
    </main>
  );
}
