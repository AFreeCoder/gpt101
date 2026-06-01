import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getUpgradeSubdomainRedirectPath,
  getUpgradeSubdomainRewritePath,
  isUpgradeSubdomainHost,
  shouldServeUpgradeSubdomainPath,
  shouldSkipGlobalCustomerService,
} from '../../src/shared/lib/upgrade-subdomain';

const repoRoot = process.cwd();

function restoreUpgradePageHosts(value: string | undefined) {
  if (value === undefined) {
    delete process.env.UPGRADE_PAGE_HOSTS;
    return;
  }

  process.env.UPGRADE_PAGE_HOSTS = value;
}

test('upgrade host detection accepts default and configured reseller domains', () => {
  const originalHosts = process.env.UPGRADE_PAGE_HOSTS;
  process.env.UPGRADE_PAGE_HOSTS = 'up.partner-example.com, upgrade.gpt101.org';

  assert.equal(isUpgradeSubdomainHost('upgrade.gpt101.org'), true);
  assert.equal(isUpgradeSubdomainHost('upgrade.gpt101.org:443'), true);
  assert.equal(isUpgradeSubdomainHost('up.partner-example.com'), true);
  assert.equal(isUpgradeSubdomainHost('UP.PARTNER-EXAMPLE.COM:443'), true);
  assert.equal(isUpgradeSubdomainHost('gpt101.org'), false);
  assert.equal(isUpgradeSubdomainHost('new.gpt101.org'), false);
  assert.equal(isUpgradeSubdomainHost(null), false);

  restoreUpgradePageHosts(originalHosts);
});

test('upgpt.app 作为内置 upgrade 域名指向 channel-upgrade', () => {
  // 不依赖 UPGRADE_PAGE_HOSTS 环境变量——upgpt.app 已内置于代码默认集合
  assert.equal(isUpgradeSubdomainHost('upgpt.app'), true);
  assert.equal(isUpgradeSubdomainHost('UPGPT.APP'), true);
  assert.equal(isUpgradeSubdomainHost('upgpt.app:443'), true);
  assert.equal(isUpgradeSubdomainHost('https://upgpt.app/'), true);
  assert.equal(getUpgradeSubdomainRedirectPath('upgpt.app', '/'), null);
  assert.equal(
    getUpgradeSubdomainRewritePath('upgpt.app', '/'),
    '/channel-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath('upgpt.app', '/upgrade'),
    '/channel-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath(
      'upgpt.app',
      '/upgrade/status/TS-20260601-0001'
    ),
    '/channel-upgrade/status/TS-20260601-0001'
  );
});

test('configured reseller domain canonicalizes and serves upgrade paths', () => {
  const originalHosts = process.env.UPGRADE_PAGE_HOSTS;
  process.env.UPGRADE_PAGE_HOSTS = 'up.partner-example.com';

  assert.equal(
    getUpgradeSubdomainRedirectPath('up.partner-example.com', '/'),
    null
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath('up.partner-example.com', '/'),
    true
  );
  assert.equal(
    shouldServeUpgradeSubdomainPath('up.partner-example.com', '/upgrade'),
    true
  );
  assert.equal(
    getUpgradeSubdomainRewritePath('up.partner-example.com', '/upgrade'),
    '/channel-upgrade'
  );
  assert.equal(shouldSkipGlobalCustomerService('up.partner-example.com'), true);

  restoreUpgradePageHosts(originalHosts);
});

test('upgrade subdomain keeps root path while canonicalizing legacy public paths', () => {
  assert.equal(
    getUpgradeSubdomainRedirectPath('upgrade.gpt101.org', '/'),
    null
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

test('upgrade subdomain serves root and canonical /upgrade paths directly', () => {
  assert.equal(
    shouldServeUpgradeSubdomainPath('upgrade.gpt101.org', '/'),
    true
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

test('upgrade subdomain rewrites canonical external URLs to isolated channel pages', () => {
  assert.equal(
    getUpgradeSubdomainRewritePath('upgrade.gpt101.org', '/'),
    '/channel-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath('upgrade.gpt101.org', '/upgrade'),
    '/channel-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath(
      'upgrade.gpt101.org',
      '/upgrade/status/TS-20260424-0001'
    ),
    '/channel-upgrade/status/TS-20260424-0001'
  );
  assert.equal(getUpgradeSubdomainRewritePath('gpt101.org', '/upgrade'), null);
});

test('upgrade subdomain skips global customer service injection', () => {
  assert.equal(shouldSkipGlobalCustomerService('upgrade.gpt101.org'), true);
  assert.equal(shouldSkipGlobalCustomerService('gpt101.org'), false);
});

test('external channel pages are isolated from the main /upgrade route', () => {
  const upgradePath = path.join(repoRoot, 'src/app/upgrade/page.tsx');
  const upgradeStatusPath = path.join(
    repoRoot,
    'src/app/upgrade/status/[taskNo]/page.tsx'
  );
  const channelUpgradePath = path.join(
    repoRoot,
    'src/app/channel-upgrade/page.tsx'
  );
  const channelUpgradeStatusPath = path.join(
    repoRoot,
    'src/app/channel-upgrade/status/[taskNo]/page.tsx'
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
  assert.equal(existsSync(channelUpgradePath), true);
  assert.equal(existsSync(channelUpgradeStatusPath), true);
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(statusPath), true);

  const upgradeSource = readFileSync(upgradePath, 'utf8');
  const upgradeStatusSource = readFileSync(upgradeStatusPath, 'utf8');
  const channelUpgradeSource = readFileSync(channelUpgradePath, 'utf8');
  const channelUpgradeStatusSource = readFileSync(
    channelUpgradeStatusPath,
    'utf8'
  );
  const pageSource = readFileSync(pagePath, 'utf8');
  const statusSource = readFileSync(statusPath, 'utf8');

  assert.doesNotMatch(upgradeSource, /presentation="channel"/);
  assert.doesNotMatch(upgradeStatusSource, /presentation="channel"/);
  assert.match(channelUpgradeSource, /showSupportCard=\{false\}/);
  assert.match(channelUpgradeSource, /supportContact=\{null\}/);
  assert.match(channelUpgradeStatusSource, /supportContact=\{null\}/);
  assert.doesNotMatch(channelUpgradeSource, /presentation="channel"/);
  assert.doesNotMatch(channelUpgradeStatusSource, /presentation="channel"/);
  assert.doesNotMatch(
    channelUpgradeSource,
    /headingKicker|headingTitle|headingDescription|卡密兑换服务台|PARTNER SERVICE DESK/
  );
  assert.match(pageSource, /redirect\('\/upgrade'\)/);
  assert.match(statusSource, /redirect\(`\/upgrade\/status\/\$\{taskNo\}`\)/);
  assert.doesNotMatch(
    channelUpgradeSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
  assert.doesNotMatch(
    channelUpgradeStatusSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
});

test('proxy bypasses intl middleware for canonical upgrade subdomain paths', () => {
  const proxySource = readFileSync(path.join(repoRoot, 'src/proxy.ts'), 'utf8');

  assert.match(proxySource, /getUpgradeSubdomainRedirectPath/);
  assert.match(proxySource, /getUpgradeSubdomainRewritePath/);
  assert.match(proxySource, /createUpgradeSubdomainRedirectUrl/);
  assert.match(proxySource, /x-forwarded-host/);
  assert.match(proxySource, /x-forwarded-proto/);
  assert.match(proxySource, /NextResponse\.rewrite/);
});
