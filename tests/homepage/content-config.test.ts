import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOWED_CONTENT_CONFIG_KEYS,
  getContentConfigValue,
  getDefaultUpgradeNoticeConfig,
  getLocalizedContentConfigKey,
  HOMEPAGE_FAQ_CONFIG_KEY,
  MIRROR_FAQ_CONFIG_KEY,
  normalizeUpgradeNoticeConfig,
  resolveFaqConfig,
  resolveFaqContentConfigForAdmin,
  resolveUpgradeNoticeConfig,
  selectHomepageFaqItems,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '../../src/shared/lib/content-config';

const fallbackFaq = {
  id: 'faqs',
  block: 'faq',
  title: '默认 FAQ',
  description: '默认说明',
  items: [
    {
      question: 'Q: 默认问题？',
      answer: '默认答案。',
    },
  ],
};

test('content config keys are explicit whitelist keys', () => {
  assert.equal(HOMEPAGE_FAQ_CONFIG_KEY, 'homepage_faq_config');
  assert.equal(MIRROR_FAQ_CONFIG_KEY, 'mirror_faq_config');
  assert.equal(UPGRADE_NOTICE_CONFIG_KEY, 'upgrade_notice_config');
  assert.ok(ALLOWED_CONTENT_CONFIG_KEYS.includes('homepage_faq_config:zh'));
  assert.ok(ALLOWED_CONTENT_CONFIG_KEYS.includes('homepage_faq_config:en'));
  assert.equal(
    getLocalizedContentConfigKey(HOMEPAGE_FAQ_CONFIG_KEY, 'zh'),
    'homepage_faq_config:zh'
  );
});

test('localized content config values prefer locale-specific config and fall back to legacy base key', () => {
  assert.equal(
    getContentConfigValue(
      {
        homepage_faq_config: 'legacy',
        'homepage_faq_config:zh': 'localized',
      },
      HOMEPAGE_FAQ_CONFIG_KEY,
      'zh'
    ),
    'localized'
  );
  assert.equal(
    getContentConfigValue(
      {
        homepage_faq_config: 'legacy',
      },
      HOMEPAGE_FAQ_CONFIG_KEY,
      'en'
    ),
    'legacy'
  );
});

test('resolveFaqConfig falls back to locale FAQ when config is missing or invalid', () => {
  assert.deepEqual(resolveFaqConfig(undefined, fallbackFaq), {
    ...fallbackFaq,
    block: 'faq',
  });
  assert.deepEqual(resolveFaqConfig('{bad json', fallbackFaq), {
    ...fallbackFaq,
    block: 'faq',
  });
});

test('admin FAQ config refuses invalid raw JSON instead of falling back to defaults', () => {
  assert.throws(
    () => resolveFaqContentConfigForAdmin('{bad json', fallbackFaq, '首页 FAQ'),
    /不是有效 JSON/
  );
});

test('resolveFaqConfig accepts structured FAQ JSON and sanitizes unsafe text', () => {
  const resolved = resolveFaqConfig(
    JSON.stringify({
      enabled: true,
      title: '后台 FAQ',
      description: '后台说明<script>alert(1)</script>',
      categories: ['账号安全', '升级流程'],
      items: [
        {
          category: '账号安全',
          question: '升级后如何降低异常概率？',
          answer:
            '不要共享账号，也不要使用 javascript:alert(1) 链接或 <script>。',
        },
      ],
    }),
    fallbackFaq
  );

  assert.equal(resolved.title, '后台 FAQ');
  assert.deepEqual(resolved.categories, ['账号安全', '升级流程']);
  assert.equal(resolved.items?.[0].category, '账号安全');
  assert.doesNotMatch(resolved.description || '', /<script/i);
  assert.doesNotMatch(resolved.items?.[0].answer || '', /javascript:/i);
  assert.doesNotMatch(resolved.items?.[0].answer || '', /</);
});

test('resolveFaqConfig preserves sanitized featured flags for FAQ items', () => {
  const resolved = resolveFaqConfig(
    JSON.stringify({
      enabled: true,
      title: '通用 FAQ',
      items: [
        {
          category: '购买前咨询',
          question: '首页精选问题？',
          answer: '首页需要展示。',
          featured: true,
        },
        {
          category: '发票开具',
          question: '只在 FAQ 页展示？',
          answer: '首页不展示。',
          featured: false,
        },
      ],
    }),
    fallbackFaq
  );

  assert.equal(resolved.items?.[0].featured, true);
  assert.equal(resolved.items?.[1].featured, false);
});

test('selectHomepageFaqItems uses featured FAQ items and falls back to first six', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    question: `问题 ${index + 1}`,
    answer: `答案 ${index + 1}`,
    featured: index === 1 || index === 6,
  }));

  assert.deepEqual(
    selectHomepageFaqItems(items).map((item) => item.question),
    ['问题 2', '问题 7']
  );

  assert.deepEqual(
    selectHomepageFaqItems(
      items.map((item) => ({ ...item, featured: false }))
    ).map((item) => item.question),
    ['问题 1', '问题 2', '问题 3', '问题 4', '问题 5', '问题 6']
  );
});

test('resolveFaqConfig can disable a FAQ section without breaking page rendering', () => {
  const resolved = resolveFaqConfig(
    JSON.stringify({
      enabled: false,
      title: '关闭 FAQ',
      items: [],
    }),
    fallbackFaq
  );

  assert.equal(resolved.disabled, true);
  assert.deepEqual(resolved.items, []);
});

test('resolveUpgradeNoticeConfig uses safe defaults and sanitizes admin text', () => {
  const fallback = getDefaultUpgradeNoticeConfig();
  const resolved = resolveUpgradeNoticeConfig(
    JSON.stringify({
      enabled: true,
      title: '升级前确认<script>',
      description: '请先阅读注意事项。',
      items: [
        '不要多人共享账号。',
        '不要使用 javascript:alert(1) 自动化脚本。',
        '<script>alert(1)</script>',
      ],
      footer: '如遇异常请联系客服。',
      buttonText: '我已了解，继续升级',
    }),
    fallback
  );

  assert.equal(resolved.enabled, true);
  assert.equal(resolved.buttonText, '我已了解，继续升级');
  assert.doesNotMatch(resolved.title, /<script/i);
  assert.doesNotMatch(resolved.items.join('\n'), /javascript:/i);
  assert.doesNotMatch(resolved.items.join('\n'), /</);
});

test('normalizeUpgradeNoticeConfig rejects values that become empty after sanitizing', () => {
  assert.throws(
    () =>
      normalizeUpgradeNoticeConfig({
        enabled: true,
        title: '<>',
        description: '请先阅读注意事项。',
        items: ['<>'],
        buttonText: '继续',
      }),
    /升级提示配置格式不正确/
  );
});

test('public upgrade notice resolver falls back when sanitized config becomes invalid', () => {
  const fallback = getDefaultUpgradeNoticeConfig();
  const resolved = resolveUpgradeNoticeConfig(
    JSON.stringify({
      enabled: true,
      title: '<>',
      description: '请先阅读注意事项。',
      items: ['<>'],
      buttonText: '继续',
    }),
    fallback
  );

  assert.deepEqual(resolved, fallback);
});

test('disabled upgrade notice can be saved without notice items', () => {
  const resolved = normalizeUpgradeNoticeConfig({
    enabled: false,
    title: '关闭升级提示',
    description: '暂不展示弹窗。',
    items: [],
    buttonText: '继续',
  });

  assert.equal(resolved.enabled, false);
  assert.deepEqual(resolved.items, []);
});
