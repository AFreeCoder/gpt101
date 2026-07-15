'use client';

import { useMemo, useState } from 'react';
import { HelpCircle, MessageCircle, Search, SearchCheck } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { CustomerSupportText } from '@/shared/components/customer-support-text';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { CUSTOMER_SUPPORT_URL } from '@/shared/lib/customer-support';
import type { FAQ } from '@/shared/types/blocks/landing';

type FaqItem = NonNullable<FAQ['items']>[number];

type FaqPageProps = {
  faq: FAQ;
  locale: string;
};

function getCopy(locale: string) {
  const isZh = locale === 'zh';

  return {
    all: isZh ? '全部' : 'All',
    other: isZh ? '其他问题' : 'Other',
    searchPlaceholder: isZh
      ? '搜索购买、升级、开票、售后问题'
      : 'Search purchase, upgrade, invoice, or support questions',
    questionCount: (count: number) =>
      isZh ? `${count} 个问题` : `${count} questions`,
    noResultTitle: isZh ? '没有找到匹配问题' : 'No matching questions',
    noResultDescription: isZh
      ? '换个关键词试试；仍然找不到时，直接联系人工客服。'
      : 'Try another keyword; if you still cannot find an answer, contact support.',
    supportTitle: isZh ? '没找到答案？' : 'Need more help?',
    supportDescription: isZh
      ? '卡密状态可先自助查询；发票申请和复杂问题请直接联系人工客服。'
      : 'Check card status by yourself first; contact support for invoices and complex questions.',
    selfQuery: isZh ? '卡密状态查询' : 'Card status query',
    contact: isZh ? '联系客服' : 'Contact support',
    searchLabel: isZh ? '搜索常见问题' : 'Search FAQs',
  };
}

function normalizeCategory(item: FaqItem, fallback: string) {
  return item.category?.trim() || fallback;
}

export function FaqPage({ faq, locale }: FaqPageProps) {
  const copy = getCopy(locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(copy.all);
  const items = useMemo(() => faq.items || [], [faq.items]);

  const categories = useMemo(() => {
    const ordered = [
      ...(faq.categories || []),
      ...items.map((item) => normalizeCategory(item, copy.other)),
    ];
    return Array.from(new Set(ordered.filter(Boolean)));
  }, [copy.other, faq.categories, items]);

  const categoryCounts = useMemo(() => {
    return categories.map((category) => ({
      category,
      count: items.filter(
        (item) => normalizeCategory(item, copy.other) === category
      ).length,
    }));
  }, [categories, copy.other, items]);

  const filteredGroups = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const visibleItems = items.filter((item) => {
      const category = normalizeCategory(item, copy.other);
      const matchesCategory =
        activeCategory === copy.all || category === activeCategory;
      const searchable = `${category} ${item.question || item.title || ''} ${
        item.answer || item.description || ''
      }`.toLowerCase();
      const matchesSearch = !keyword || searchable.includes(keyword);

      return matchesCategory && matchesSearch;
    });

    return categories
      .map((category) => ({
        category,
        items: visibleItems.filter(
          (item) => normalizeCategory(item, copy.other) === category
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeCategory, categories, copy.all, copy.other, items, searchQuery]);

  const totalVisible = filteredGroups.reduce(
    (total, group) => total + group.items.length,
    0
  );

  const supportLinks: Array<{
    title: string;
    href: string;
    icon: typeof SearchCheck;
    external?: boolean;
  }> = [
    {
      title: copy.selfQuery,
      href: '/query',
      icon: SearchCheck,
    },
    {
      title: copy.contact,
      href: CUSTOMER_SUPPORT_URL,
      icon: MessageCircle,
      external: true,
    },
  ];

  return (
    <main className="bg-background min-h-screen">
      <section className="border-border/70 bg-muted/30 border-b">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
          <div className="max-w-3xl">
            <div className="border-primary/20 text-primary bg-background mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </div>
            <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl">
              {faq.title ||
                (locale === 'zh' ? '有什么可以帮到你？' : 'How can we help?')}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7 md:text-lg">
              {faq.description ||
                (locale === 'zh'
                  ? '整理了购买、升级、使用、开票和售后的常见问题。'
                  : 'Browse common questions about purchase, upgrade, usage, invoices, and support.')}
            </p>
          </div>

          <div className="relative mt-8 max-w-3xl">
            <label htmlFor="faq-search" className="sr-only">
              {copy.searchLabel}
            </label>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
            <input
              id="faq-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary h-13 w-full rounded-lg border px-12 text-base shadow-sm transition-colors outline-none"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[17rem_1fr] md:px-8 md:py-14">
        <aside className="space-y-5 md:sticky md:top-24 md:self-start">
          <div className="border-border bg-background rounded-lg border p-3 shadow-sm">
            <button
              type="button"
              aria-pressed={activeCategory === copy.all}
              onClick={() => setActiveCategory(copy.all)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activeCategory === copy.all
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{copy.all}</span>
              <span>{items.length}</span>
            </button>
            <div className="mt-2 space-y-1">
              {categoryCounts.map(({ category, count }) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="min-w-0 truncate">{category}</span>
                  <span className="shrink-0">{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-border bg-background rounded-lg border p-5 shadow-sm">
            <h2 className="text-foreground text-base font-semibold">
              {copy.supportTitle}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {copy.supportDescription}
            </p>
            <div className="mt-4 grid gap-2">
              {supportLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="border-border hover:bg-muted flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex min-h-8 items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {copy.questionCount(totalVisible)}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {locale === 'zh' ? '清除搜索' : 'Clear search'}
              </button>
            )}
          </div>

          {filteredGroups.length === 0 ? (
            <div className="border-border bg-background rounded-lg border p-8 text-center shadow-sm">
              <Search className="text-muted-foreground mx-auto h-8 w-8" />
              <h2 className="text-foreground mt-4 text-lg font-semibold">
                {copy.noResultTitle}
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
                {copy.noResultDescription}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a
                  href={CUSTOMER_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:bg-muted inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {copy.contact}
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredGroups.map((group) => (
                <section key={group.category} id={`faq-${group.category}`}>
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                      {group.category}
                    </h2>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {copy.questionCount(group.items.length)}
                    </span>
                  </div>
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue={
                      group.items[0]?.question || group.items[0]?.title || ''
                    }
                    className="space-y-3"
                  >
                    {group.items.map((item, index) => (
                      <AccordionItem
                        key={item.question || item.title || index}
                        value={item.question || item.title || String(index)}
                        className="border-border bg-background data-[state=open]:bg-muted/35 rounded-lg border px-5 shadow-sm transition-colors"
                      >
                        <AccordionTrigger className="cursor-pointer gap-4 py-4 text-left text-base font-medium hover:no-underline">
                          {item.question || item.title || ''}
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground pb-4 text-base leading-7">
                            <CustomerSupportText>
                              {item.answer || item.description || ''}
                            </CustomerSupportText>
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
