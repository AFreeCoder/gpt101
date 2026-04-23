import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readLandingHeader(locale: 'zh' | 'en') {
  const filePath = path.join(
    process.cwd(),
    'src/config/locale/messages',
    locale,
    'landing.json'
  );
  const content = readFileSync(filePath, 'utf8');
  const config = JSON.parse(content);

  return config.header;
}

function readSource(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

test('中文 landing header 打开登录入口', () => {
  const header = readLandingHeader('zh');

  assert.equal(header.show_sign, true);
});

test('英文 landing header 打开登录入口', () => {
  const header = readLandingHeader('en');

  assert.equal(header.show_sign, true);
});

test('landing header 登录入口固定回跳 admin', () => {
  const headerSource = readSource('src/themes/default/blocks/header.tsx');
  const signUserSource = readSource('src/shared/blocks/sign/sign-user.tsx');

  assert.match(
    headerSource,
    /<SignUser\s+userNav=\{header\.user_nav\}\s+callbackUrl="\/admin"\s*\/>/s
  );
  assert.match(signUserSource, /<SignModal callbackUrl=\{callbackUrl\} \/>/);
});
