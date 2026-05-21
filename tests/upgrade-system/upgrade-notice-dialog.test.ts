import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('upgrade page passes backend-configured notice into UpgradeFlow', () => {
  const pageSource = readFileSync(
    path.join(repoRoot, 'src/app/[locale]/(landing)/upgrade/page.tsx'),
    'utf8'
  );
  const subdomainPageSource = readFileSync(
    path.join(repoRoot, 'src/app/upgrade/page.tsx'),
    'utf8'
  );

  assert.match(pageSource, /resolveUpgradeNoticeConfig/);
  assert.match(pageSource, /UPGRADE_NOTICE_CONFIG_KEY/);
  assert.match(pageSource, /noticeConfig=\{noticeConfig\}/);
  assert.match(subdomainPageSource, /resolveUpgradeNoticeConfig/);
  assert.match(subdomainPageSource, /noticeConfig=\{noticeConfig\}/);
});

test('UpgradeFlow shows a mandatory notice dialog before the upgrade flow', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );

  assert.match(source, /noticeConfig/);
  assert.match(source, /noticeAcknowledged/);
  assert.match(source, /Dialog open=\{shouldShowNotice\}/);
  assert.match(
    source,
    /onInteractOutside=\{\(event\) => event\.preventDefault\(\)\}/
  );
  assert.match(
    source,
    /onEscapeKeyDown=\{\(event\) => event\.preventDefault\(\)\}/
  );
  assert.match(source, /showCloseButton=\{false\}/);
  assert.match(source, /我已了解，继续升级/);
  assert.match(source, /upgrade_notice_ack/);
  assert.doesNotMatch(source, /sessionStorage/);
});
