import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function readSource(filePath: string) {
  return readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test('FAQ block supports category filters and no longer renders backend text as HTML', () => {
  const source = readSource('src/themes/default/blocks/faq.tsx');

  assert.match(source, /useState/);
  assert.match(source, /activeCategory/);
  assert.match(source, /filteredItems/);
  assert.match(source, /section\.categories/);
  assert.match(source, /全部/);
  assert.match(source, /defaultValue=\{\s*filteredItems\[0\]\?/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test('home page resolves FAQ from content config before rendering UI and JSON-LD', () => {
  const source = readSource('src/app/[locale]/(landing)/page.tsx');

  assert.match(source, /resolveFaqConfig/);
  assert.match(source, /selectHomepageFaqItems/);
  assert.match(source, /HOMEPAGE_FAQ_CONFIG_KEY/);
  assert.match(
    source,
    /page\.sections = \{[\s\S]*\.\.\.page\.sections,[\s\S]*faq: homepageFaq/
  );
  assert.match(source, /buildFaqJsonLd\(homepageFaqItems\)/);
});

test('mirror page renders configurable FAQ and emits FAQ JSON-LD', () => {
  const pageSource = readSource(
    'src/app/[locale]/(landing)/chatgpt-mirror/page.tsx'
  );
  const zhConfig = JSON.parse(
    readSource('src/config/locale/messages/zh/pages/chatgpt-mirror.json')
  );
  const enConfig = JSON.parse(
    readSource('src/config/locale/messages/en/pages/chatgpt-mirror.json')
  );

  assert.match(pageSource, /resolveFaqConfig/);
  assert.match(pageSource, /MIRROR_FAQ_CONFIG_KEY/);
  assert.match(pageSource, /buildFaqJsonLd\(resolvedFaq\.items \|\| \[\]\)/);
  assert.ok(zhConfig.page.show_sections.includes('faq'));
  assert.ok(enConfig.page.show_sections.includes('faq'));
  assert.equal(zhConfig.page.sections.faq.block, 'faq');
  assert.equal(enConfig.page.sections.faq.block, 'faq');
});

test('home page locale FAQ includes a renderable FAQ block', () => {
  const zhConfig = JSON.parse(
    readSource('src/config/locale/messages/zh/pages/index.json')
  );
  const enConfig = JSON.parse(
    readSource('src/config/locale/messages/en/pages/index.json')
  );

  assert.equal(zhConfig.page.sections.faq.block, 'faq');
  assert.equal(enConfig.page.sections.faq.block, 'faq');
});

test('FAQ page route uses homepage FAQ config as the full FAQ source', () => {
  const pageSource = readSource('src/app/[locale]/(landing)/faq/page.tsx');
  const blockSource = readSource('src/themes/default/blocks/faq-page.tsx');

  assert.match(pageSource, /HOMEPAGE_FAQ_CONFIG_KEY/);
  assert.match(pageSource, /getTranslations\('pages\.index'\)/);
  assert.match(pageSource, /resolveFaqConfig/);
  assert.match(pageSource, /buildFaqJsonLd\(resolvedFaq\.items \|\| \[\]\)/);
  assert.match(pageSource, /alternates:\s*\{[\s\S]*canonical/);
  assert.match(blockSource, /useState/);
  assert.match(blockSource, /searchQuery/);
  assert.match(blockSource, /filteredGroups/);
  assert.match(blockSource, /\/query/);
  assert.match(blockSource, /\/#customer-support/);
  assert.doesNotMatch(blockSource, /\/batch-query/);
  assert.doesNotMatch(blockSource, /invoiceUrl/);
});

test('landing navigation exposes FAQ and user card query links', () => {
  const zhLanding = JSON.parse(
    readSource('src/config/locale/messages/zh/landing.json')
  );
  const enLanding = JSON.parse(
    readSource('src/config/locale/messages/en/landing.json')
  );

  assert.ok(
    zhLanding.header.nav.items.some(
      (item: { url?: string }) => item.url === '/faq'
    )
  );
  assert.ok(
    enLanding.header.nav.items.some(
      (item: { url?: string }) => item.url === '/faq'
    )
  );
  assert.ok(
    zhLanding.footer.nav.items
      .flatMap(
        (group: { children?: Array<{ url?: string }> }) => group.children || []
      )
      .some((item: { url?: string }) => item.url === '/query')
  );
  assert.ok(
    enLanding.footer.nav.items
      .flatMap(
        (group: { children?: Array<{ url?: string }> }) => group.children || []
      )
      .some((item: { url?: string }) => item.url === '/query')
  );
  assert.ok(
    !zhLanding.footer.nav.items
      .flatMap(
        (group: { children?: Array<{ url?: string }> }) => group.children || []
      )
      .some((item: { url?: string }) => item.url === '/batch-query')
  );
});

test('user card query page reuses upgrade verify-code API', () => {
  const pageSource = readSource('src/app/[locale]/(landing)/query/page.tsx');
  const clientSource = readSource(
    'src/app/[locale]/(landing)/query/query-client.tsx'
  );

  assert.match(pageSource, /卡密状态查询|Card status query/);
  assert.match(clientSource, /\/api\/upgrade\/verify-code/);
  assert.match(clientSource, /UpgradeTaskSummary/);
  assert.doesNotMatch(clientSource, /\/batch-query/);
});

test('content config cache revalidates the standalone FAQ page', () => {
  const source = readSource('src/shared/models/content-config.ts');

  assert.match(source, /\/faq/);
});
