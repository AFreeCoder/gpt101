import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import robots from '../../src/app/robots';
import sitemap from '../../src/app/sitemap';
import { defaultLocale } from '../../src/config/locale';
import { proxy } from '../../src/proxy';

const repoRoot = process.cwd();
const siteUrl = 'https://gpt101.org';

function readSource(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function localizedUrl(pathname: string, locale: string) {
  const suffix = pathname === '/' ? '' : pathname;
  return `${siteUrl}${locale === defaultLocale ? '' : `/${locale}`}${suffix}`;
}

test('robots 允许抓取公开政策页，同时保留私有路径边界', () => {
  const config = robots();
  const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
  const disallow = Array.isArray(rules.disallow)
    ? rules.disallow
    : [rules.disallow].filter(Boolean);

  assert.doesNotMatch(disallow.join('\n'), /privacy-policy|terms-of-service/);
  assert.doesNotMatch(disallow.join('\n'), /\?[\s\S]*q=/);
  assert.deepEqual(disallow, [
    '/settings/*',
    '/activity/*',
    '/admin/*',
    '/api/*',
  ]);
});

test('robots 和 sitemap 默认使用公网域名，不能泄漏 localhost', () => {
  const robotsConfig = robots();
  const urls = sitemap().map((entry) => entry.url);

  assert.equal(robotsConfig.sitemap, `${siteUrl}/sitemap.xml`);
  assert.equal(
    urls.every((url) => url.startsWith(siteUrl)),
    true
  );
  assert.equal(
    urls.some((url) => url.includes('localhost')),
    false
  );
});

test('sitemap 只收录规范公开页和中文教程', () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  for (const pathname of [
    '/',
    '/faq',
    '/chatgpt-mirror',
    '/lp/g/upgrade-chatgpt',
    '/privacy-policy',
    '/terms-of-service',
  ]) {
    assert.ok(urls.includes(localizedUrl(pathname, 'zh')));
    assert.ok(urls.includes(localizedUrl(pathname, 'en')));
  }

  assert.ok(urls.includes(localizedUrl('/tutorials', 'zh')));
  assert.ok(
    urls.includes(localizedUrl('/tutorials/how-to-upgrade-gpt-plus', 'zh'))
  );
  assert.ok(
    urls.includes(localizedUrl('/tutorials/chatgpt-mirror-guide', 'zh'))
  );

  assert.equal(
    urls.some((url) => url === localizedUrl('/tutorials', 'en')),
    false
  );
  assert.equal(
    urls.some((url) =>
      /(?:qf-dtyuedan-buy|\/upgrade(?:$|\/)|\/chat(?:$|\/)|\/query(?:$|\?))/.test(
        new URL(url).pathname
      )
    ),
    false
  );
  assert.equal(
    urls.some((url) =>
      url.endsWith('/tutorials/2025-latest-7-way-to-upgrade-chatgpt-plus')
    ),
    false
  );
  assert.equal(
    urls.some((url) => url.includes('?')),
    false
  );
});

test('双语 sitemap 项声明一致的语言替代，教程不声明英文副本', () => {
  const entries = sitemap();
  const faqEntries = entries.filter((entry) => entry.url.endsWith('/faq'));
  const tutorialEntries = entries.filter((entry) =>
    entry.url.includes('/tutorials')
  );

  assert.equal(faqEntries.length, 2);
  for (const entry of faqEntries) {
    assert.deepEqual(entry.alternates?.languages, {
      en: localizedUrl('/faq', 'en'),
      zh: localizedUrl('/faq', 'zh'),
    });
  }

  assert.equal(
    tutorialEntries.every((entry) => !entry.alternates?.languages?.en),
    true
  );
});

test('sitemap 不用运行时当前时间伪造页面更新时间', () => {
  const today = new Date().toISOString().slice(0, 10);
  const lastModifiedDates = sitemap()
    .map((entry) => entry.lastModified)
    .filter(Boolean)
    .map((value) => new Date(value!).toISOString().slice(0, 10));

  assert.doesNotMatch(
    lastModifiedDates.join('\n'),
    new RegExp(`^${today}$`, 'm')
  );
});

test('sitemap 在容器运行时读取生产语言配置，不固化构建机默认值', () => {
  const sitemapSource = readSource('src/app/sitemap.ts');

  assert.match(
    sitemapSource,
    /export const dynamic\s*=\s*['"]force-dynamic['"]/
  );
});

test('缺省 metadata 不再把任意页面 canonical 到首页', () => {
  const seoSource = readSource('src/shared/lib/seo.ts');
  const homepageSource = readSource('src/app/[locale]/(landing)/page.tsx');

  assert.doesNotMatch(
    seoSource,
    /if\s*\(!canonicalUrl\)\s*\{\s*canonicalUrl\s*=\s*['"]\/['"]/
  );
  assert.match(homepageSource, /canonicalUrl:\s*['"]\/['"]/);
});

test('工具流程明确 noindex，不再继承首页 canonical', () => {
  const upgradeSource = readSource(
    'src/app/[locale]/(landing)/upgrade/page.tsx'
  );
  const upgradeStatusSource = readSource(
    'src/app/[locale]/(landing)/upgrade/status/[taskNo]/page.tsx'
  );
  const chatLayoutSource = readSource('src/app/[locale]/(chat)/layout.tsx');

  assert.match(upgradeSource, /noIndex:\s*true/);
  assert.match(upgradeStatusSource, /index:\s*false/);
  assert.match(chatLayoutSource, /noIndex:\s*true/);
});

test('根布局不再硬编码全站 hreflang，双语落地页使用翻译元数据', () => {
  const rootLayoutSource = readSource('src/app/layout.tsx');
  const mirrorSource = readSource(
    'src/app/[locale]/(landing)/chatgpt-mirror/page.tsx'
  );
  const landingSource = readSource(
    'src/app/[locale]/(landing)/lp/g/upgrade-chatgpt/page.tsx'
  );

  assert.doesNotMatch(rootLayoutSource, /hrefLang|rel=['"]alternate['"]/);
  assert.match(
    mirrorSource,
    /metadataKey:\s*['"]pages\.chatgpt-mirror\.metadata['"]/
  );
  assert.match(
    landingSource,
    /metadataKey:\s*['"]pages\.lp-upgrade-chatgpt\.metadata['"]/
  );
});

test('教程语言守卫在代理层合并伪英文 URL 并移除错误替代链接', () => {
  const proxySource = readSource('src/proxy.ts');

  assert.match(proxySource, /getTutorialLocaleRedirectPath/);
  assert.match(proxySource, /NextResponse\.redirect\([\s\S]*308/);
  assert.match(proxySource, /shouldSuppressAlternateLinks/);
  assert.match(proxySource, /headers\.delete\(['"]Link['"]\)/);
});

test('教程规范跳转固定使用站点域名并保留查询参数', async () => {
  const request = new NextRequest(
    'http://internal.local/en/tutorials/how-to-upgrade-gpt-plus?source=test',
    {
      headers: {
        host: 'attacker.example',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'http',
      },
    }
  );

  const response = await proxy(request);

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    `${localizedUrl('/tutorials/how-to-upgrade-gpt-plus', 'zh')}?source=test`
  );
});

test('公开 query 页通过 X-Robots-Tag 明确 noindex 且保留 follow', () => {
  const proxySource = readSource('src/proxy.ts');

  assert.match(proxySource, /applyQueryRobotsHeader/);
  assert.match(proxySource, /searchParams\.has\('q'\)/);
  assert.match(proxySource, /X-Robots-Tag/);
  assert.match(proxySource, /noindex,\s*follow/);
});

test('缺失教程文章返回真正的 404，不渲染 200 空状态页', () => {
  const tutorialDetailSource = readSource(
    'src/app/[locale]/(landing)/tutorials/[slug]/page.tsx'
  );

  assert.match(tutorialDetailSource, /from 'next\/navigation'/);
  assert.match(tutorialDetailSource, /notFound\(\)/);
  assert.doesNotMatch(tutorialDetailSource, /Post not found/);
  assert.match(tutorialDetailSource, /robots:\s*\{[\s\S]*index:\s*false/);
});
