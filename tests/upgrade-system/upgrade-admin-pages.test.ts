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

test('upgrade tasks admin page exposes manual task entry', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/upgrade-tasks/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/upgrade-tasks/manualEntry/route.ts'
  );

  assert.match(pageSource, /任务补录/);
  assert.match(pageSource, /本站卡密/);
  assert.match(pageSource, /用户 Token/);
  assert.match(pageSource, /用户邮箱/);
  assert.match(pageSource, /上游渠道卡密/);
  assert.match(pageSource, /\/api\/admin\/upgrade-tasks\/manualEntry/);
  assert.match(routeSource, /PERMISSIONS\.UPGRADE_TASK_WRITE/);
  assert.match(routeSource, /createManualUpgradeTask/);
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
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/channel-cardkeys/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/channel-cardkeys/enable/route.ts'
  );

  assert.match(pageSource, /<th[^>]*>\s*渠道\s*<\/th>/);
  assert.match(pageSource, /批量禁用/);
  assert.match(pageSource, /批量取消禁用/);
  assert.match(pageSource, /\/api\/admin\/channel-cardkeys\/disable/);
  assert.match(pageSource, /\/api\/admin\/channel-cardkeys\/enable/);
  assert.match(routeSource, /PERMISSIONS\.CHANNEL_CARDKEY_WRITE/);
  assert.match(routeSource, /batchEnableCardkeys/);
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

test('redeem codes admin page offers batch enable for disabled codes', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/redeem-codes/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/redeem-codes/enable/route.ts'
  );

  assert.match(pageSource, /批量取消禁用/);
  assert.match(pageSource, /\/api\/admin\/redeem-codes\/enable/);
  assert.match(routeSource, /PERMISSIONS\.REDEEM_WRITE/);
  assert.match(routeSource, /batchEnable/);
});

test('redeem code generator exposes configurable cardkey prefix', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/redeem-codes/generate/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/redeem-codes/generate/route.ts'
  );

  assert.match(pageSource, /卡密前缀/);
  assert.match(pageSource, /validateRedeemCodePrefix/);
  assert.match(pageSource, /normalizeRedeemCodePrefix/);
  assert.match(pageSource, /prefix: normalizeRedeemCodePrefix\(prefix\)/);
  assert.match(routeSource, /validateRedeemCodePrefix/);
  assert.match(routeSource, /prefix: prefix \? String\(prefix\) : undefined/);
});

test('redeem code batch query admin page exposes textarea query and status filters', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/redeem-codes/batch-query/page.tsx'
  );
  const routeSource = readSource(
    'src/app/api/admin/redeem-codes/batch-query/route.ts'
  );
  const sidebarSource = readSource(
    'src/config/locale/messages/zh/admin/sidebar.json'
  );

  assert.match(sidebarSource, /\/admin\/redeem-codes\/batch-query/);
  assert.match(pageSource, /批量查询/);
  assert.match(pageSource, /textarea/);
  assert.match(pageSource, /最多 100 个/);
  assert.match(pageSource, /\/api\/admin\/redeem-codes\/batch-query/);
  assert.match(pageSource, /filterTab/);
  assert.match(pageSource, /已使用/);
  assert.match(pageSource, /未使用/);
  assert.match(pageSource, /usedByEmail/);
  assert.match(pageSource, /usedAt/);
  assert.match(routeSource, /PERMISSIONS\.REDEEM_READ/);
  assert.match(routeSource, /queryRedeemCodeUsageBatch/);
  assert.match(routeSource, /最多查询 100 个卡密/);
});

test('redeem code batch query admin page offers pasted batch disable and delete actions', () => {
  const pageSource = readSource(
    'src/app/[locale]/(admin)/admin/redeem-codes/batch-query/page.tsx'
  );
  const disableRouteSource = readSource(
    'src/app/api/admin/redeem-codes/batch-disable-by-code/route.ts'
  );
  const deleteRouteSource = readSource(
    'src/app/api/admin/redeem-codes/batch-delete-by-code/route.ts'
  );

  assert.match(pageSource, /批量禁用可用卡密/);
  assert.match(pageSource, /批量删除未使用\/已禁用卡密/);
  assert.match(pageSource, /\/api\/admin\/redeem-codes\/batch-disable-by-code/);
  assert.match(pageSource, /\/api\/admin\/redeem-codes\/batch-delete-by-code/);
  assert.match(pageSource, /affectedCount/);
  assert.match(disableRouteSource, /PERMISSIONS\.REDEEM_WRITE/);
  assert.match(deleteRouteSource, /PERMISSIONS\.REDEEM_DELETE/);
  assert.match(disableRouteSource, /batchDisableCodesByText/);
  assert.match(deleteRouteSource, /batchDeleteCodesByText/);
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
  const listRouteSource = readSource(
    'src/app/api/admin/upgrade-partners/list/route.ts'
  );
  const createRouteSource = readSource(
    'src/app/api/admin/upgrade-partners/create/route.ts'
  );
  const updateRouteSource = readSource(
    'src/app/api/admin/upgrade-partners/update/route.ts'
  );
  const deleteRouteSource = readSource(
    'src/app/api/admin/upgrade-partners/delete/route.ts'
  );
  const sidebar = JSON.parse(sidebarSource);
  const upgradeNav = sidebar.main_navs.find(
    (nav: { title?: string }) => nav.title === '升级管理'
  );
  const upstreamNav = upgradeNav.items.find(
    (item: { title?: string }) => item.title === '上游渠道'
  );

  assert.match(sidebarSource, /\/admin\/upgrade-partners/);
  assert.ok(
    upgradeNav.items.some(
      (item: { title?: string; url?: string }) =>
        item.title === '第三方接入' && item.url === '/admin/upgrade-partners'
    )
  );
  assert.ok(
    !upstreamNav.children.some(
      (item: { url?: string }) => item.url === '/admin/upgrade-partners'
    )
  );
  assert.match(pageSource, /新建接入方/);
  assert.match(pageSource, /查询名称、appKey 或备注/);
  assert.match(pageSource, /appKey/);
  assert.match(pageSource, /appSecret/);
  assert.match(pageSource, /创建后不可修改/);
  assert.match(pageSource, /handleDelete/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/create/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/update/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/delete/);
  assert.match(pageSource, /\/api\/admin\/upgrade-partners\/rotate-secret/);
  assert.match(listRouteSource, /search:/);
  assert.match(listRouteSource, /status:/);
  assert.match(listRouteSource, /PERMISSIONS\.UPGRADE_PARTNER_READ/);
  assert.match(createRouteSource, /PERMISSIONS\.UPGRADE_PARTNER_WRITE/);
  assert.match(deleteRouteSource, /deletePartnerApp/);
  assert.match(deleteRouteSource, /PERMISSIONS\.UPGRADE_PARTNER_WRITE/);
  assert.doesNotMatch(updateRouteSource, /name:\s*body\.name/);
  assert.doesNotMatch(listRouteSource, /UPGRADE_CHANNEL/);
  assert.doesNotMatch(createRouteSource, /UPGRADE_CHANNEL/);
});

test('dashboard layout constrains wide admin tables to the content viewport', () => {
  const source = readSource('src/shared/blocks/dashboard/layout.tsx');

  assert.match(source, /<SidebarInset className="w-0 min-w-0">/);
});

test('client-only admin pages render the dashboard header for mobile sidebar access', () => {
  const clientAdminPages = [
    'src/app/[locale]/(admin)/admin/channel-cardkeys/page.tsx',
    'src/app/[locale]/(admin)/admin/redeem-codes/generate/page.tsx',
    'src/app/[locale]/(admin)/admin/redeem-codes/batch-query/page.tsx',
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
