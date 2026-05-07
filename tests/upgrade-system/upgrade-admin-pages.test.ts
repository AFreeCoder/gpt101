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

test('channel cardkeys admin page shows channel and offers batch disable', () => {
  const source = readSource(
    'src/app/[locale]/(admin)/admin/channel-cardkeys/page.tsx'
  );

  assert.match(source, /<th[^>]*>\s*渠道\s*<\/th>/);
  assert.match(source, /批量禁用/);
  assert.match(source, /\/api\/admin\/channel-cardkeys\/disable/);
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
