import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getUpgradeSubdomainRedirectPath,
  isUpgradeSubdomainHost,
  shouldServeUpgradeSubdomainPath,
  shouldSkipGlobalCustomerService,
} from '../../src/shared/lib/upgrade-subdomain';

const repoRoot = process.cwd();

test('upgrade subdomain host detection accepts only upgrade.gpt101.org', () => {
  assert.equal(isUpgradeSubdomainHost('upgrade.gpt101.org'), true);
  assert.equal(isUpgradeSubdomainHost('upgrade.gpt101.org:443'), true);
  assert.equal(isUpgradeSubdomainHost('gpt101.org'), false);
  assert.equal(isUpgradeSubdomainHost('new.gpt101.org'), false);
  assert.equal(isUpgradeSubdomainHost(null), false);
});

test('upgrade subdomain canonicalizes public paths to /upgrade', () => {
  assert.equal(
    getUpgradeSubdomainRedirectPath('upgrade.gpt101.org', '/'),
    '/upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath('upgrade.gpt101.org', '/upgrade'),
    null
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath('upgrade.gpt101.org', '/zh/upgrade'),
    '/upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath(
      'upgrade.gpt101.org',
      '/status/TS-20260424-0001'
    ),
    '/upgrade/status/TS-20260424-0001'
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath(
      'upgrade.gpt101.org',
      '/upgrade/status/TS-20260424-0001'
    ),
    null
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath('upgrade.gpt101.org', '/agent-upgrade'),
    '/upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRedirectPath(
      'upgrade.gpt101.org',
      '/zh/agent-upgrade/status/TS-20260424-0001'
    ),
    '/upgrade/status/TS-20260424-0001'
  );
  assert.equal(getUpgradeSubdomainRedirectPath('gpt101.org', '/'), null);
});

test('upgrade subdomain serves only canonical /upgrade paths directly', () => {
  assert.equal(
    shouldServeUpgradeSubdomainPath('upgrade.gpt101.org', '/'),
    false
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath('upgrade.gpt101.org', '/upgrade'),
    true
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath('upgrade.gpt101.org', '/zh/upgrade'),
    false
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath(
      'upgrade.gpt101.org',
      '/upgrade/status/TS-20260424-0001'
    ),
    true
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath('gpt101.org', '/upgrade'),
    false
  );
});

test('upgrade subdomain skips global customer service injection', () => {
  assert.equal(shouldSkipGlobalCustomerService('upgrade.gpt101.org'), true);
  assert.equal(shouldSkipGlobalCustomerService('gpt101.org'), false);
});

test('top-level upgrade pages serve reseller flow and old agent paths redirect to /upgrade', () => {
  const upgradePath = path.join(repoRoot, 'src/app/upgrade/page.tsx');
  const upgradeStatusPath = path.join(
    repoRoot,
    'src/app/upgrade/status/[taskNo]/page.tsx'
  );
  const pagePath = path.join(
    repoRoot,
    'src/app/[locale]/(agent-upgrade)/agent-upgrade/page.tsx'
  );
  const statusPath = path.join(
    repoRoot,
    'src/app/[locale]/(agent-upgrade)/agent-upgrade/status/[taskNo]/page.tsx'
  );

  assert.equal(existsSync(upgradePath), true);
  assert.equal(existsSync(upgradeStatusPath), true);
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(statusPath), true);

  const upgradeSource = readFileSync(upgradePath, 'utf8');
  const upgradeStatusSource = readFileSync(upgradeStatusPath, 'utf8');
  const pageSource = readFileSync(pagePath, 'utf8');
  const statusSource = readFileSync(statusPath, 'utf8');

  assert.match(upgradeSource, /showSupportCard=\{false\}/);
  assert.match(upgradeSource, /supportContact=\{null\}/);
  assert.match(upgradeStatusSource, /supportContact=\{null\}/);
  assert.match(pageSource, /redirect\('\/upgrade'\)/);
  assert.match(statusSource, /redirect\(`\/upgrade\/status\/\$\{taskNo\}`\)/);
  assert.doesNotMatch(
    upgradeSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
  assert.doesNotMatch(
    upgradeStatusSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
});

test('proxy bypasses intl middleware for canonical upgrade subdomain paths', () => {
  const proxySource = readFileSync(path.join(repoRoot, 'src/proxy.ts'), 'utf8');

  assert.match(proxySource, /getUpgradeSubdomainRedirectPath/);
  assert.match(proxySource, /shouldServeUpgradeSubdomainPath/);
  assert.match(proxySource, /createUpgradeSubdomainRedirectUrl/);
  assert.match(proxySource, /x-forwarded-host/);
  assert.match(proxySource, /x-forwarded-proto/);
  assert.match(proxySource, /NextResponse\.next\(\)/);
});
