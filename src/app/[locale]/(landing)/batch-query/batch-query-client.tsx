'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';

import { getProductMemberLabel } from '@/shared/lib/redeem-code';
import { formatTimestampWithoutTimeZone } from '@/shared/lib/time';

type FilterTab = 'all' | 'used' | 'unused' | 'disabled' | 'not_found';

interface BatchQueryItem {
  code: string;
  state: Exclude<FilterTab, 'all'>;
  used: boolean;
  status: string | null;
  productCode: string | null;
  memberType: string | null;
  usedAt: string | null;
  usedByEmail: string | null;
}

interface BatchQuerySummary {
  total: number;
  used: number;
  unused: number;
  disabled: number;
  notFound: number;
}

const EMPTY_SUMMARY: BatchQuerySummary = {
  total: 0,
  used: 0,
  unused: 0,
  disabled: 0,
  notFound: 0,
};

const STATE_META: Record<
  BatchQueryItem['state'],
  { label: string; className: string; dotClassName: string }
> = {
  used: {
    label: '已使用',
    className: 'bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
  unused: {
    label: '未使用',
    className: 'bg-emerald-500/10 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  disabled: {
    label: '已禁用',
    className: 'bg-destructive/10 text-destructive',
    dotClassName: 'bg-destructive',
  },
  not_found: {
    label: '未找到',
    className: 'bg-amber-500/10 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
};

function parseInputCodes(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatProduct(item: BatchQueryItem) {
  if (!item.productCode || !item.memberType) return '-';
  return getProductMemberLabel(item.productCode, item.memberType);
}

function buildResultText(items: BatchQueryItem[]) {
  const rows = items.map((item) =>
    [
      item.code,
      STATE_META[item.state].label,
      formatProduct(item),
      formatTimestampWithoutTimeZone(item.usedAt),
      item.usedByEmail || '-',
    ].join('\t')
  );

  return ['卡密\t状态\t产品/会员\t使用时间\t使用邮箱', ...rows].join('\n');
}

export function BatchQueryClient() {
  const [queryText, setQueryText] = useState('');
  const [items, setItems] = useState<BatchQueryItem[]>([]);
  const [summary, setSummary] = useState<BatchQuerySummary>(EMPTY_SUMMARY);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasQueried, setHasQueried] = useState(false);

  const inputCodes = useMemo(() => parseInputCodes(queryText), [queryText]);
  const filteredItems = useMemo(() => {
    if (filterTab === 'all') return items;
    return items.filter((item) => item.state === filterTab);
  }, [filterTab, items]);

  const tabs: Array<{ key: FilterTab; label: string; count: number }> = [
    { key: 'all', label: '全部', count: summary.total },
    { key: 'used', label: '已使用', count: summary.used },
    { key: 'unused', label: '未使用', count: summary.unused },
    { key: 'disabled', label: '已禁用', count: summary.disabled },
    { key: 'not_found', label: '未找到', count: summary.notFound },
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (inputCodes.length === 0) {
      setError('请粘贴至少一个卡密');
      return;
    }
    if (inputCodes.length > 100) {
      setError('最多 100 个卡密');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/redeem-codes/batch-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: inputCodes }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setItems(data.data.items);
        setSummary(data.data.summary);
        setFilterTab('all');
        setHasQueried(true);
        setNotice(`已完成 ${data.data.summary.total} 个卡密查询`);
      } else {
        setError(data.message || '查询失败');
      }
    } catch {
      setError('查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQueryText('');
    setItems([]);
    setSummary(EMPTY_SUMMARY);
    setFilterTab('all');
    setError('');
    setNotice('');
    setHasQueried(false);
  };

  const handleCopy = async () => {
    if (items.length === 0) return;

    try {
      await navigator.clipboard.writeText(buildResultText(items));
      setError('');
      setNotice('查询结果已复制');
    } catch {
      setError('复制失败，请手动选择表格内容');
    }
  };

  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto w-full max-w-7xl px-4 pt-24 pb-16 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            本站卡密批量查询
          </h1>
          <p className="text-muted-foreground mt-3 text-base">
            每行粘贴一个本站卡密，可一次查询使用状态、使用时间和脱敏邮箱。
          </p>
        </div>

        <div className="space-y-5">
          <form
            onSubmit={handleSubmit}
            className="bg-card rounded-lg border p-4 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <label
                  htmlFor="batch-query-codes"
                  className="text-base font-semibold"
                >
                  卡密列表
                </label>
                <p className="text-muted-foreground mt-1 text-sm">
                  每行一个卡密，最多 100 个。
                </p>
              </div>
              <div
                className={`bg-muted rounded-lg px-2.5 py-1 text-sm font-medium ${
                  inputCodes.length > 100
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                {inputCodes.length} / 100
              </div>
            </div>

            <textarea
              id="batch-query-codes"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={
                'GPT101-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\nKOL88-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
              }
              rows={12}
              className="border-input bg-background placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 min-h-[300px] w-full resize-y rounded-lg border p-3 font-mono text-sm transition-colors outline-none focus:ring-2"
            />

            {(error || notice) && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  error
                    ? 'border-destructive/20 bg-destructive/10 text-destructive'
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                }`}
              >
                {error ? (
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
                )}
                <span>{error || notice}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="border-input bg-background hover:bg-muted inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                清空
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? '查询中...' : '批量查询'}
              </button>
            </div>
          </form>

          <section className="bg-card rounded-lg border p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">查询结果</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  使用邮箱为脱敏展示。
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={items.length === 0}
                className="border-input bg-background hover:bg-muted inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                复制结果
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={filterTab === tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`min-h-20 cursor-pointer rounded-lg border px-3 py-3 text-left transition-colors ${
                    filterTab === tab.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  <div className="text-muted-foreground text-xs font-medium">
                    {tab.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{tab.count}</div>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      卡密
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      状态
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      产品/会员
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      使用时间
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      使用邮箱
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!hasQueried ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-muted-foreground px-3 py-14 text-center text-sm"
                      >
                        暂无查询结果
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-muted-foreground px-3 py-14 text-center text-sm"
                      >
                        当前筛选无结果
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => (
                      <tr key={`${item.code}-${index}`} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {item.code}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_META[item.state].className}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${STATE_META[item.state].dotClassName}`}
                            />
                            {STATE_META[item.state].label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatProduct(item)}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                          {formatTimestampWithoutTimeZone(item.usedAt)}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                          {item.usedByEmail || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
