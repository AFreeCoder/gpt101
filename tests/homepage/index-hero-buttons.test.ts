import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readButtons(locale: 'zh' | 'en') {
  const filePath = path.join(
    process.cwd(),
    'src/config/locale/messages',
    locale,
    'pages/index.json'
  );
  const content = readFileSync(filePath, 'utf8');
  const config = JSON.parse(content);

  return config.page.sections.hero.buttons;
}

test('中文首页同时保留购买和升级按钮', () => {
  const buttons = readButtons('zh');

  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons[0], {
    title: '购买',
    url: 'https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj',
    variant: 'default',
  });
  assert.deepEqual(buttons[1], {
    title: '立即升级',
    url: '/upgrade?source=home',
    variant: 'outline',
  });
});

test('英文首页同时保留购买和升级按钮', () => {
  const buttons = readButtons('en');

  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons[0], {
    title: 'Buy Now',
    url: 'https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj',
    variant: 'default',
  });
  assert.deepEqual(buttons[1], {
    title: 'Upgrade Now',
    url: '/upgrade?source=home',
    variant: 'outline',
  });
});
