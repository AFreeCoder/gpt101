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
  assert.match(source, /HOMEPAGE_FAQ_CONFIG_KEY/);
  assert.match(
    source,
    /page\.sections = \{[\s\S]*\.\.\.page\.sections,[\s\S]*faq: resolvedFaq/
  );
  assert.match(source, /buildFaqJsonLd\(resolvedFaq\.items \|\| \[\]\)/);
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
