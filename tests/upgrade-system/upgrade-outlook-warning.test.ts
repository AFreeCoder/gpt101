import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('upgrade email warning detects Outlook email addresses after token verification', async () => {
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
  assert.equal(isOutlookEmail('user@example.com'), false);
  assert.equal(isOutlookEmail('outlook@example.com'), false);
  assert.equal(isOutlookEmail('not-an-email'), false);
});

test('upgrade flow shows the Outlook risk warning below token verification', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );

  assert.match(source, /isOutlookEmail\(accountEmail\)/);
  assert.match(source, /由于特殊原因，outlook 邮箱账号存在封号风险， 请修改。/);
  assert.match(
    source,
    /修改步骤：网页登录 ChatGPT，点击【头像—>设置—>账户—>电子邮件】，进行修改/
  );
});
