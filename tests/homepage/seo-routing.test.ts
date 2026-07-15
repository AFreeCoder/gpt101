import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLocalizedPathname,
  getLocalizedUrl,
  getTutorialLocaleRedirectPath,
  parseLocalizedPath,
  shouldSuppressAlternateLinks,
} from '../../src/shared/lib/seo-routing';

const locales = ['en', 'zh'];

test('多语言路径解析同时返回有效语言和无语言前缀路径', () => {
  assert.deepEqual(parseLocalizedPath('/en/tutorials/guide', 'zh', locales), {
    locale: 'en',
    pathWithoutLocale: '/tutorials/guide',
    hasLocalePrefix: true,
  });
  assert.deepEqual(parseLocalizedPath('/tutorials/guide', 'zh', locales), {
    locale: 'zh',
    pathWithoutLocale: '/tutorials/guide',
    hasLocalePrefix: false,
  });
  assert.deepEqual(parseLocalizedPath('/zh/', 'en', locales), {
    locale: 'zh',
    pathWithoutLocale: '/',
    hasLocalePrefix: true,
  });
});

test('路径和完整 URL 遵循当前默认语言前缀规则', () => {
  assert.equal(getLocalizedPathname('/', 'zh', 'zh'), '/');
  assert.equal(getLocalizedPathname('/faq', 'en', 'zh'), '/en/faq');
  assert.equal(
    getLocalizedUrl('https://gpt101.org/', '/faq', 'zh', 'zh'),
    'https://gpt101.org/faq'
  );
  assert.equal(
    getLocalizedUrl('https://gpt101.org', '/', 'en', 'zh'),
    'https://gpt101.org/en'
  );
});

test('只有中文内容的教程从其他语言永久合并到中文规范路径', () => {
  assert.equal(
    getTutorialLocaleRedirectPath('/en/tutorials', 'zh', locales),
    '/tutorials'
  );
  assert.equal(
    getTutorialLocaleRedirectPath(
      '/en/tutorials/category/beginner',
      'zh',
      locales
    ),
    '/tutorials/category/beginner'
  );
  assert.equal(
    getTutorialLocaleRedirectPath('/tutorials/guide', 'en', locales),
    '/zh/tutorials/guide'
  );
  assert.equal(
    getTutorialLocaleRedirectPath('/zh/tutorials/guide', 'en', locales),
    null
  );
  assert.equal(getTutorialLocaleRedirectPath('/en/faq', 'zh', locales), null);
});

test('单语言教程和 noindex 工具页不输出语言替代关系', () => {
  assert.equal(shouldSuppressAlternateLinks('/tutorials'), true);
  assert.equal(shouldSuppressAlternateLinks('/tutorials/guide'), true);
  assert.equal(shouldSuppressAlternateLinks('/upgrade/status/task-1'), true);
  assert.equal(shouldSuppressAlternateLinks('/chat/history'), true);
  assert.equal(shouldSuppressAlternateLinks('/faq'), false);
});
