'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import type {
  FaqContentConfig,
  UpgradeNoticeConfig,
} from '@/shared/lib/content-config';

export type ContentConfigEditorPayload = {
  homepageFaqConfig: FaqContentConfig;
  mirrorFaqConfig: FaqContentConfig;
  upgradeNoticeConfig: UpgradeNoticeConfig;
};

type SaveResult = {
  status: 'success' | 'error';
  message: string;
};

type ContentConfigEditorProps = {
  initialValue: ContentConfigEditorPayload;
  onSave: (payload: ContentConfigEditorPayload) => Promise<SaveResult>;
};

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function FaqEditor({
  title,
  description = '使用结构化字段编辑，保存后会同步影响页面 FAQ 和 FAQ JSON-LD。',
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: FaqContentConfig;
  onChange: (value: FaqContentConfig) => void;
}) {
  const updateItem = (
    index: number,
    patch: Partial<FaqContentConfig['items'][number]>
  ) => {
    const items = value.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    onChange({ ...value, items });
  };

  return (
    <section className="bg-card rounded-lg border p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) =>
              onChange({ ...value, enabled: event.target.checked })
            }
          />
          启用
        </label>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">
          标题
          <input
            value={value.title}
            onChange={(event) =>
              onChange({ ...value, title: event.target.value })
            }
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          描述
          <textarea
            value={value.description || ''}
            onChange={(event) =>
              onChange({ ...value, description: event.target.value })
            }
            rows={2}
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          分类（每行一个）
          <textarea
            value={value.categories.join('\n')}
            onChange={(event) =>
              onChange({ ...value, categories: splitLines(event.target.value) })
            }
            rows={3}
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {value.items.map((item, index) => (
          <div key={index} className="bg-background rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                FAQ 条目 {index + 1}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() =>
                    onChange({
                      ...value,
                      items: moveItem(value.items, index, index - 1),
                    })
                  }
                  className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
                >
                  上移
                </button>
                <button
                  type="button"
                  disabled={index === value.items.length - 1}
                  onClick={() =>
                    onChange({
                      ...value,
                      items: moveItem(value.items, index, index + 1),
                    })
                  }
                  className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      items: value.items.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    })
                  }
                  className="text-destructive rounded-md border px-2 py-1 text-xs"
                >
                  删除
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              <input
                value={item.category || ''}
                onChange={(event) =>
                  updateItem(index, { category: event.target.value })
                }
                placeholder="分类"
                className="bg-background rounded-md border px-3 py-2 text-sm"
              />
              <input
                value={item.question}
                onChange={(event) =>
                  updateItem(index, { question: event.target.value })
                }
                placeholder="问题"
                className="bg-background rounded-md border px-3 py-2 text-sm"
              />
              <textarea
                value={item.answer}
                onChange={(event) =>
                  updateItem(index, { answer: event.target.value })
                }
                placeholder="答案"
                rows={3}
                className="bg-background rounded-md border px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.featured === true}
                  onChange={(event) =>
                    updateItem(index, { featured: event.target.checked })
                  }
                />
                首页精选
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              items: [
                ...value.items,
                {
                  category: value.categories[0] || '',
                  question: '',
                  answer: '',
                  featured: false,
                },
              ],
            })
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          新增 FAQ
        </button>
      </div>
    </section>
  );
}

function NoticeEditor({
  value,
  onChange,
}: {
  value: UpgradeNoticeConfig;
  onChange: (value: UpgradeNoticeConfig) => void;
}) {
  return (
    <section className="bg-card rounded-lg border p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">升级流程弹窗</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            用户进入升级页后会先看到这组注意事项。
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) =>
              onChange({ ...value, enabled: event.target.checked })
            }
          />
          启用
        </label>
      </div>
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">
          标题
          <input
            value={value.title}
            onChange={(event) =>
              onChange({ ...value, title: event.target.value })
            }
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          描述
          <textarea
            value={value.description}
            onChange={(event) =>
              onChange({ ...value, description: event.target.value })
            }
            rows={2}
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          注意事项（每行一条）
          <textarea
            value={value.items.join('\n')}
            onChange={(event) =>
              onChange({ ...value, items: splitLines(event.target.value) })
            }
            rows={6}
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          底部说明
          <textarea
            value={value.footer || ''}
            onChange={(event) =>
              onChange({ ...value, footer: event.target.value })
            }
            rows={2}
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-2 text-sm">
          按钮文案
          <input
            value={value.buttonText}
            onChange={(event) =>
              onChange({ ...value, buttonText: event.target.value })
            }
            className="bg-background rounded-md border px-3 py-2"
          />
        </label>
      </div>
    </section>
  );
}

export function ContentConfigEditor({
  initialValue,
  onSave,
}: ContentConfigEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await onSave(value);
        if (result.status === 'success') {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : '内容配置保存失败，请稍后重试'
        );
      }
    });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <FaqEditor
        title="通用 FAQ"
        description="/faq 展示全部常见问题，首页只展示勾选“首页精选”的问题；若没有勾选项，首页默认展示前 6 条。"
        value={value.homepageFaqConfig}
        onChange={(homepageFaqConfig) =>
          setValue((current) => ({ ...current, homepageFaqConfig }))
        }
      />
      <FaqEditor
        title="镜像页 FAQ"
        value={value.mirrorFaqConfig}
        onChange={(mirrorFaqConfig) =>
          setValue((current) => ({ ...current, mirrorFaqConfig }))
        }
      />
      <NoticeEditor
        value={value.upgradeNoticeConfig}
        onChange={(upgradeNoticeConfig) =>
          setValue((current) => ({ ...current, upgradeNoticeConfig }))
        }
      />
      <div className="bg-background/95 sticky bottom-4 flex justify-end rounded-lg border p-4 shadow-lg backdrop-blur">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? '保存中...' : '保存内容配置'}
        </button>
      </div>
    </div>
  );
}
