import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('upgrade tasks admin page exposes a rebind channel cardkey action', () => {
  const source = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-tasks/page.tsx'
  );

  assert.match(source, /更换卡密/);
  assert.match(source, /\/api\/admin\/upgrade-tasks\/rebindCardkey/);
});

test('upgrade tasks admin page explains manual-required failures', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-tasks/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/upgrade-tasks/list/route.ts'
  );

  assert.match(pageSource, /需人工处理/);
  assert.match(pageSource, /manualRequiredReason/);
  assert.match(routeSource, /manualRequiredReason/);
});

test('channel cardkeys admin page shows channel and offers batch disable', () => {
  const source = readSource(
    'src/app/[locale]/(admin)/admin/channel-cardkeys/page.tsx'
  );

  assert.match(source, /<th[^>]*>\s*渠道\s*<\/th>/);
  assert.match(source, /批量禁用/);
  assert.match(source, /\/api\/admin\/channel-cardkeys\/disable/);
});

test('redeem codes admin page exposes code search while preserving filters', () => {
  const source = readSource(
    'src/app/[locale]/(admin)/admin/redeem-codes/page.tsx'
  );

  assert.match(source, /placeholder="搜索卡密/);
  assert.match(source, /const \[searchInput,\s*setSearchInput\]/);
  assert.match(source, /searchInput\.trim\(\)/);
  assert.match(
    source,
    /router\.push\(buildUrl\(\{[\s\S]*search:\s*keyword,[\s\S]*page:\s*''/
  );
  assert.match(
    source,
    /router\.push\(buildUrl\(\{[\s\S]*search:\s*'',[\s\S]*page:\s*''/
  );
  assert.match(
    source,
    /status,[\s\S]*productCode,[\s\S]*memberType,[\s\S]*batchId,[\s\S]*search/
  );
});

test('upgrade task attempts admin page and API include site redeem cardkey', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-task-attempts/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/upgrade-task-attempts/list/route.ts'
  );

  assert.match(pageSource, /本站卡密/);
  assert.match(pageSource, /redeemCodePlain/);
  assert.match(routeSource, /redeemCodePlain/);
});

test('upgrade task attempts table scrolls internally without truncating long fields', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-task-attempts/page.tsx'
  );

  assert.match(pageSource, /overflow-x-auto/);
  assert.match(pageSource, /<table className="w-max min-w-full text-sm">/);
  assert.match(pageSource, /whitespace-nowrap/);
  assert.match(
    pageSource,
    /min-w-\[420px\] max-w-\[720px\] whitespace-normal break-words/
  );
  assert.doesNotMatch(pageSource, /truncate/);
});

test('upgrade partners admin page exposes app key provisioning actions', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-partners/page.tsx'
  );
  const sidebarSource = readSource(
    'src/config/locale/messages/zh/admin/sidebar.json'
  );

  assert.match(sidebarSource, /\/admin\/upgrade-partners/);
  assert.match(pageSource, /新建接入方/);
  assert.match(pageSource, /appKey/);
  assert.match(pageSource, /appSecret/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/create/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/update/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/rotate-secret/);
});

test('dashboard layout constrains wide admin tables to the content viewport', () => {
  const source = readSource('src/shared/blocks/dashboard/layout.tsx');

  assert.match(source, /<SidebarInset className="w-0 min-w-0">/);
});

test('client-only admin pages render the dashboard header for mobile sidebar access', () => {
  const clientAdminPages = [
    'src/app/[locale]/(admin)/admin/channel-cardkeys/page.tsx',
    'src/app/[locale]/(admin)/admin/redeem-codes/generate/page.tsx',
    'src/app/[locale]/(admin)/admin/redeem-codes/page.tsx',
    'src/app/[locale]/(admin)/admin/upgrade-channels/[id]/cardkeys/page.tsx',
    'src/app/[locale]/(admin)/admin/upgrade-channels/page.tsx',
    'src/app/[locale]/(admin)/admin/upgrade-partners/page.tsx',
    'src/app/[locale]/(admin)/admin/upgrade-task-attempts/page.tsx',
    'src/app/[locale]/(admin)/admin/upgrade-tasks/page.tsx',
  ];

  for (const pagePath of clientAdminPages) {
    const source = readSource(pagePath);

    assert.match(source, /@\/shared\/blocks\/dashboard/);
    assert.match(source, /<Header\b/);
  }
});
