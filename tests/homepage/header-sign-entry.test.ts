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

test('中文 landing header 隐藏公开登录入口', () => {
  const header = readLandingHeader('zh');

  assert.equal(header.show_sign, false);
});

test('英文 landing header 隐藏公开登录入口', () => {
  const header = readLandingHeader('en');

  assert.equal(header.show_sign, false);
});

test('管理员登录页默认回跳 admin', () => {
  const signInPageSource = readSource(
    'src/app/[locale]/(auth)/sign-in/page.tsx'
  );

  assert.match(
    signInPageSource,
    /<SignIn[\s\S]*callbackUrl=\{callbackUrl \|\| '\/admin'\}/
  );
});
