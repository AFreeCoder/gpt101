'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { RotateCcw, Search } from 'lucide-react';

import { Header } from '@/shared/blocks/dashboard';
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
  { label: string; className: string }
> = {
  used: { label: '已使用', className: 'bg-gray-100 text-gray-600' },
  unused: { label: '未使用', className: 'bg-green-50 text-green-600' },
  disabled: { label: '已禁用', className: 'bg-red-50 text-red-600' },
  not_found: { label: '未找到', className: 'bg-yellow-50 text-yellow-700' },
};

function parseInputCodes(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function RedeemCodeBatchQueryPage() {
  const [queryText, setQueryText] = useState('');
  const [items, setItems] = useState<BatchQueryItem[]>([]);
  const [summary, setSummary] = useState<BatchQuerySummary>(EMPTY_SUMMARY);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      const res = await fetch('/api/admin/redeem-codes/batch-query', {
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
    setHasQueried(false);
  };

  return (
    <>
      <Header />
      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">本站卡密批量查询</h2>
            <p className="mt-1 text-sm text-gray-500">
              每行一个卡密，最多 100 个。
            </p>
          </div>
          <a
            href="/admin/redeem-codes"
            className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            返回卡密列表
          </a>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="GPT101-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            rows={8}
            className="min-h-44 w-full rounded-lg border p-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div
              className={`text-sm ${inputCodes.length > 100 ? 'text-red-600' : 'text-gray-500'}`}
            >
              已输入 {inputCodes.length} / 100 个
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                清空
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {loading ? '查询中...' : '批量查询'}
              </button>
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </form>

        {hasQueried && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    filterTab === tab.key
                      ? 'border-blue-600 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm text-gray-500">{tab.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{tab.count}</div>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      卡密
                    </th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      状态
                    </th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      产品/会员
                    </th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      使用日期
                    </th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      使用者邮箱
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-gray-400"
                      >
                        暂无结果
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => (
                      <tr
                        key={`${item.code}-${index}`}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {item.code}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATE_META[item.state].className}`}
                          >
                            {STATE_META[item.state].label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {item.productCode && item.memberType
                            ? getProductMemberLabel(
                                item.productCode,
                                item.memberType
                              )
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                          {formatTimestampWithoutTimeZone(item.usedAt)}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">
                          {item.usedByEmail || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
