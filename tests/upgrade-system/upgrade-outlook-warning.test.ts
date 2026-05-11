import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('upgrade email warning detects Outlook and Hotmail email addresses after token verification', async () => {
  const helperPath = path.join(
    repoRoot,
    'src/shared/lib/upgrade-email-warning.ts'
  );

  assert.equal(existsSync(helperPath), true);

  const { isOutlookEmail } = await import(
    '../../src/shared/lib/upgrade-email-warning'
  );

  assert.equal(isOutlookEmail('user@outlook.com'), true);
  assert.equal(isOutlookEmail(' User@Outlook.Com '), true);
  assert.equal(isOutlookEmail('user@hotmail.com'), true);
  assert.equal(isOutlookEmail(' User@Hotmail.Com '), true);
  assert.equal(isOutlookEmail('user@example.com'), false);
  assert.equal(isOutlookEmail('outlook@example.com'), false);
  assert.equal(isOutlookEmail('user@not-hotmail.com'), false);
  assert.equal(isOutlookEmail('user@sub.hotmail.com'), false);
  assert.equal(isOutlookEmail('not-an-email'), false);
});

test('upgrade flow shows the Outlook risk warning at the top and below token verification', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );

  assert.match(source, /isOutlookEmail\(accountEmail\)/);
  assert.match(
    source,
    /因官方风控问题，GPT 账号为 outlook 或 hotmail 邮箱的用户，/
  );
  assert.match(source, /需要更换为 gmail、QQ 等其他邮箱。/);
  assert.match(
    source,
    /因官方风控问题，outlook \/ hotmail\s*邮箱账号存在封号风险，\s*请修改。/
  );
  assert.match(
    source,
    /更换步骤：网页登录 ChatGPT，点击【头像—设置—账户—电子邮件】，进行修改。/
  );
});

test('upgrade flow blocks the next step for Outlook or Hotmail accounts after token verification', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );

  assert.match(
    source,
    /const canConfirmUpgrade = tokenParsed && !isOutlookEmail\(accountEmail\)/
  );
  assert.match(
    source,
    /setError\('请将 ChatGPT 账号邮箱更换为 gmail、QQ 等其他邮箱后再继续升级'\)/
  );
  assert.match(
    source,
    /!canConfirmUpgrade \? 'border-border\/20 bg-muted\/20 pointer-events-none opacity-40'/
  );
  assert.match(
    source,
    /disabled=\{loading === 'submit' \|\| !canConfirmUpgrade\}/
  );
});
