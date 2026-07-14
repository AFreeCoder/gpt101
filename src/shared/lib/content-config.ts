import { z } from 'zod';

import { replaceLegacyCustomerSupportText } from '@/shared/lib/customer-support';
import type { FAQ } from '@/shared/types/blocks/landing';

export const HOMEPAGE_FAQ_CONFIG_KEY = 'homepage_faq_config';
export const MIRROR_FAQ_CONFIG_KEY = 'mirror_faq_config';
export const UPGRADE_NOTICE_CONFIG_KEY = 'upgrade_notice_config';
export const CONTENT_CONFIG_LOCALES = ['en', 'zh'] as const;

export const CONTENT_CONFIG_BASE_KEYS = [
  HOMEPAGE_FAQ_CONFIG_KEY,
  MIRROR_FAQ_CONFIG_KEY,
  UPGRADE_NOTICE_CONFIG_KEY,
] as const;

export const ALLOWED_CONTENT_CONFIG_KEYS = [
  ...CONTENT_CONFIG_BASE_KEYS,
  'homepage_faq_config:en',
  'homepage_faq_config:zh',
  'mirror_faq_config:en',
  'mirror_faq_config:zh',
  'upgrade_notice_config:en',
  'upgrade_notice_config:zh',
] as const;

export type ContentConfigBaseKey = (typeof CONTENT_CONFIG_BASE_KEYS)[number];
export type ContentConfigKey = (typeof ALLOWED_CONTENT_CONFIG_KEYS)[number];
export type ContentConfigValues = Partial<Record<ContentConfigKey, string>>;

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 800;
const MAX_ANSWER_LENGTH = 1400;
const MAX_ITEMS = 30;

export type FaqContentConfig = {
  enabled: boolean;
  id?: string;
  title: string;
  description?: string;
  categories: string[];
  items: Array<{
    category?: string;
    question: string;
    answer: string;
    featured?: boolean;
  }>;
  tip?: string;
};

export type UpgradeNoticeConfig = {
  enabled: boolean;
  title: string;
  description: string;
  items: string[];
  footer?: string;
  buttonText: string;
};

const faqContentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().default(''),
  categories: z.array(z.string().min(1).max(40)).max(12).optional().default([]),
  items: z
    .array(
      z.object({
        category: z.string().max(40).optional().default(''),
        question: z.string().min(1).max(MAX_TITLE_LENGTH),
        answer: z.string().min(1).max(MAX_ANSWER_LENGTH),
        featured: z.boolean().optional().default(false),
      })
    )
    .max(MAX_ITEMS)
    .optional()
    .default([]),
  tip: z.string().max(MAX_DESCRIPTION_LENGTH).optional().default(''),
});

const upgradeNoticeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
  items: z.array(z.string().min(1).max(240)).max(8).optional().default([]),
  footer: z.string().max(MAX_DESCRIPTION_LENGTH).optional().default(''),
  buttonText: z.string().min(1).max(40),
});

function sanitizeText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/javascript:/gi, 'javascript-')
    .replace(/[<>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseJsonObject(value?: string | null) {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonObjectStrict(
  value: string | undefined | null,
  label: string
) {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} 不是有效 JSON，已停止载入以避免覆盖现有配置`);
  }
}

function isContentConfigLocale(locale: string) {
  return CONTENT_CONFIG_LOCALES.includes(
    locale as (typeof CONTENT_CONFIG_LOCALES)[number]
  );
}

export function getLocalizedContentConfigKey(
  key: ContentConfigBaseKey,
  locale: string
): ContentConfigKey {
  if (!isContentConfigLocale(locale)) {
    return key;
  }

  return `${key}:${locale}` as ContentConfigKey;
}

export function getContentConfigValue(
  values: ContentConfigValues,
  key: ContentConfigBaseKey,
  locale: string
) {
  return values[getLocalizedContentConfigKey(key, locale)] ?? values[key];
}

function sanitizeFaqConfig(config: FaqContentConfig): FaqContentConfig {
  const items = config.items
    .map((item) => ({
      category: sanitizeText(item.category || '', 40),
      question: sanitizeText(item.question, MAX_TITLE_LENGTH),
      answer: replaceLegacyCustomerSupportText(
        sanitizeText(item.answer, MAX_ANSWER_LENGTH)
      ),
      featured: item.featured === true,
    }))
    .filter((item) => item.question && item.answer);

  const categories = unique([
    ...config.categories.map((item) => sanitizeText(item, 40)),
    ...items.map((item) => item.category || ''),
  ]);

  return {
    enabled: config.enabled,
    id: config.id ? sanitizeText(config.id, 64) : undefined,
    title: sanitizeText(config.title, MAX_TITLE_LENGTH),
    description: sanitizeText(config.description || '', MAX_DESCRIPTION_LENGTH),
    categories,
    items,
    tip: sanitizeText(config.tip || '', MAX_DESCRIPTION_LENGTH),
  };
}

export function normalizeFaqContentConfig(config: FaqContentConfig) {
  const result = faqContentConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error('FAQ 配置格式不正确');
  }

  return sanitizeFaqConfig(result.data);
}

export function normalizeUpgradeNoticeConfig(config: UpgradeNoticeConfig) {
  const result = upgradeNoticeConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error('升级提示配置格式不正确');
  }

  const normalized = {
    enabled: result.data.enabled,
    title: sanitizeText(result.data.title, MAX_TITLE_LENGTH),
    description: sanitizeText(result.data.description, MAX_DESCRIPTION_LENGTH),
    items: result.data.items
      .map((item) => sanitizeText(item, 240))
      .filter(Boolean),
    footer: sanitizeText(result.data.footer || '', MAX_DESCRIPTION_LENGTH),
    buttonText: sanitizeText(result.data.buttonText, 40),
  };

  if (
    !normalized.title ||
    !normalized.description ||
    !normalized.buttonText ||
    (normalized.enabled && normalized.items.length === 0)
  ) {
    throw new Error('升级提示配置格式不正确');
  }

  return normalized;
}

export function faqSectionToContentConfig(faq: FAQ): FaqContentConfig {
  return {
    enabled: faq.disabled !== true,
    id: faq.id || 'faqs',
    title: faq.title || 'FAQ',
    description: faq.description || '',
    categories: faq.categories || [],
    items: (faq.items || []).map((item) => ({
      category: item.category || '',
      question: item.question || item.title || '',
      answer: item.answer || item.description || '',
      featured: item.featured === true,
    })),
    tip: faq.tip || '',
  };
}

export function selectHomepageFaqItems(
  items: FAQ['items'] = [],
  limit = 6
): NonNullable<FAQ['items']> {
  const featuredItems = items.filter((item) => item.featured === true);

  if (featuredItems.length > 0) {
    return featuredItems;
  }

  return items.slice(0, limit);
}

export function resolveFaqConfig(
  rawConfig: string | undefined | null,
  fallbackFaq: FAQ
): FAQ {
  const parsed = parseJsonObject(rawConfig);
  const result = parsed ? faqContentConfigSchema.safeParse(parsed) : null;

  if (!result?.success) {
    return {
      ...fallbackFaq,
      block: fallbackFaq.block || 'faq',
    };
  }

  const config = normalizeFaqContentConfig(result.data);
  const resolved: FAQ = {
    ...fallbackFaq,
    id: config.id || fallbackFaq.id || 'faqs',
    block: fallbackFaq.block || 'faq',
    title: config.title,
    description: config.description,
    categories: config.categories,
    tip: config.tip,
    items: config.items,
  };

  if (!config.enabled) {
    return {
      ...resolved,
      disabled: true,
      items: [],
    };
  }

  return resolved;
}

export function resolveFaqContentConfigForAdmin(
  rawConfig: string | undefined | null,
  fallbackFaq: FAQ,
  label = 'FAQ'
): FaqContentConfig {
  const parsed = parseJsonObjectStrict(rawConfig, label);
  if (!parsed) {
    return faqSectionToContentConfig(fallbackFaq);
  }

  const result = faqContentConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${label} 配置格式不正确，已停止载入以避免覆盖现有配置`);
  }

  return normalizeFaqContentConfig(result.data);
}

export function getDefaultUpgradeNoticeConfig(): UpgradeNoticeConfig {
  return {
    enabled: true,
    title: '升级前请确认这些事项',
    description:
      '为降低账号异常概率，请先阅读以下使用建议。确认后会进入卡密核验流程，不会自动提交升级。',
    items: [
      '请使用本人长期稳定使用的 ChatGPT 账号。',
      '不要多人共享、出租或转卖账号，避免异地同时登录。',
      '不要使用脚本、自动化工具或批量高频请求等异常方式。',
      '尽量保持稳定网络环境，避免短时间频繁切换地区或 IP。',
      '账号已出现登录异常、频繁验证或官方限制时，请先暂停操作并联系客服。',
    ],
    footer: '如遇账号异常，我们会协助核查升级任务和可支持的售后处理。',
    buttonText: '我已了解，继续升级',
  };
}

export function resolveUpgradeNoticeConfig(
  rawConfig?: string | null,
  fallbackNotice: UpgradeNoticeConfig = getDefaultUpgradeNoticeConfig()
): UpgradeNoticeConfig {
  const parsed = parseJsonObject(rawConfig);
  const result = parsed ? upgradeNoticeConfigSchema.safeParse(parsed) : null;

  if (!result?.success) {
    return fallbackNotice;
  }

  try {
    return normalizeUpgradeNoticeConfig(result.data);
  } catch {
    return fallbackNotice;
  }
}

export function resolveUpgradeNoticeConfigForAdmin(
  rawConfig?: string | null,
  fallbackNotice: UpgradeNoticeConfig = getDefaultUpgradeNoticeConfig(),
  label = '升级流程弹窗'
): UpgradeNoticeConfig {
  const parsed = parseJsonObjectStrict(rawConfig, label);
  if (!parsed) {
    return fallbackNotice;
  }

  const result = upgradeNoticeConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${label} 配置格式不正确，已停止载入以避免覆盖现有配置`);
  }

  return normalizeUpgradeNoticeConfig(result.data);
}
