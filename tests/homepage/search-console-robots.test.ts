import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import robots from '../../src/app/robots';
import sitemap from '../../src/app/sitemap';

const repoRoot = process.cwd();

test('robots 不再阻断带 q 参数的公开 query URL', () => {
  const config = robots();
  const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
  const disallow = Array.isArray(rules.disallow)
    ? rules.disallow
    : [rules.disallow].filter(Boolean);

  assert.doesNotMatch(disallow.join('\n'), /\?[\s\S]*q=/);
  assert.deepEqual(disallow, [
    '/privacy-policy',
    '/terms-of-service',
    '/settings/*',
    '/activity/*',
    '/admin/*',
    '/api/*',
  ]);
});

test('robots 和 sitemap 默认使用公网域名，不能泄漏 localhost', () => {
  const robotsConfig = robots();
  const urls = sitemap().map((entry) => entry.url);

  assert.equal(robotsConfig.sitemap, 'https://gpt101.org/sitemap.xml');
  assert.equal(
    urls.every((url) => url.startsWith('https://gpt101.org')),
    true
  );
  assert.equal(
    urls.some((url) => url.includes('localhost')),
    false
  );
});

test('sitemap 只暴露规范公开页，不输出 query URL', () => {
  const urls = sitemap().map((entry) => entry.url);

  assert.ok(urls.some((url) => url.endsWith('/lp/g/upgrade-chatgpt')));
  assert.ok(urls.some((url) => url.endsWith('/tutorials')));
  assert.ok(
    urls.some((url) =>
      url.endsWith('/tutorials/2025-latest-7-way-to-upgrade-chatgpt-plus')
    )
  );
  assert.equal(
    urls.some((url) => url.includes('?')),
    false
  );
  assert.equal(
    urls.some((url) => url.endsWith('/upgrade')),
    false
  );
});

test('公开 query 页通过 X-Robots-Tag 明确 noindex 且保留 follow', () => {
  const proxySource = readFileSync(path.join(repoRoot, 'src/proxy.ts'), 'utf8');

  assert.match(proxySource, /applyQueryRobotsHeader/);
  assert.match(proxySource, /searchParams\.has\('q'\)/);
  assert.match(proxySource, /X-Robots-Tag/);
  assert.match(proxySource, /noindex,\s*follow/);
});

test('公开页 metadata 保留 canonical，upgrade 子域入口保留 noindex', () => {
  const lpSource = readFileSync(
    path.join(
      repoRoot,
      'src/app/[locale]/(landing)/lp/g/upgrade-chatgpt/page.tsx'
    ),
    'utf8'
  );
  const tutorialsSource = readFileSync(
    path.join(repoRoot, 'src/app/[locale]/(landing)/tutorials/page.tsx'),
    'utf8'
  );
  const upgradeSource = readFileSync(
    path.join(repoRoot, 'src/app/upgrade/page.tsx'),
    'utf8'
  );

  assert.match(lpSource, /canonicalUrl:\s*'\/lp\/g\/upgrade-chatgpt'/);
  assert.match(tutorialsSource, /canonicalUrl:\s*'\/tutorials'/);
  assert.match(upgradeSource, /robots:\s*\{[\s\S]*index:\s*false/);
});
