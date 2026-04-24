import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getUpgradeSubdomainRewritePath,
  isUpgradeSubdomainHost,
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

test('upgrade subdomain rewrites clean entry and status paths to internal pages', () => {
  assert.equal(
    getUpgradeSubdomainRewritePath('upgrade.gpt101.org', '/'),
    '/agent-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath('upgrade.gpt101.org', '/upgrade'),
    '/agent-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath('upgrade.gpt101.org', '/zh/upgrade'),
    '/agent-upgrade'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath(
      'upgrade.gpt101.org',
      '/status/TS-20260424-0001'
    ),
    '/agent-upgrade/status/TS-20260424-0001'
  );
  assert.equal(
    getUpgradeSubdomainRewritePath(
      'upgrade.gpt101.org',
      '/upgrade/status/TS-20260424-0001'
    ),
    '/agent-upgrade/status/TS-20260424-0001'
  );
  assert.equal(getUpgradeSubdomainRewritePath('gpt101.org', '/'), null);
});

test('upgrade subdomain skips global customer service injection', () => {
  assert.equal(shouldSkipGlobalCustomerService('upgrade.gpt101.org'), true);
  assert.equal(shouldSkipGlobalCustomerService('gpt101.org'), false);
});

test('agent upgrade pages are isolated from landing layout and hard-coded GPT101 support id', () => {
  const pagePath = path.join(
    repoRoot,
    'src/app/[locale]/(agent-upgrade)/agent-upgrade/page.tsx'
  );
  const statusPath = path.join(
    repoRoot,
    'src/app/[locale]/(agent-upgrade)/agent-upgrade/status/[taskNo]/page.tsx'
  );

  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(statusPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const statusSource = readFileSync(statusPath, 'utf8');

  assert.match(pageSource, /UpgradeFlow/);
  assert.match(statusSource, /UpgradeStatusView/);
  assert.doesNotMatch(
    pageSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
  assert.doesNotMatch(
    statusSource,
    /AFreeCoder01|联系客服微信|Footer|Header|TopBanner/
  );
});

test('locale layout avoids serializing site messages on upgrade subdomain', () => {
  const layoutSource = readFileSync(
    path.join(repoRoot, 'src/app/[locale]/layout.tsx'),
    'utf8'
  );

  assert.match(layoutSource, /isUpgradeSubdomainHost/);
  assert.match(
    layoutSource,
    /messages=\{useMinimalIntlMessages \? \{\} : undefined\}/
  );
});
