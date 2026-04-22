import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readButtons(locale: 'zh' | 'en') {
  const filePath = path.join(
    process.cwd(),
    'src/config/locale/messages',
    locale,
    'pages/lp-upgrade-chatgpt.json'
  );
  const content = readFileSync(filePath, 'utf8');
  const config = JSON.parse(content);

  return config.page.sections.hero.buttons;
}

test('中文广告页同时保留购买和升级按钮', () => {
  const buttons = readButtons('zh');

  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons[0], {
    title: '立即购买',
    url: 'https://fe.dtyuedan.cn/shop/F2OLER91/52wtgh',
    variant: 'default',
  });
  assert.deepEqual(buttons[1], {
    title: '立即升级',
    url: '/upgrade?source=ad-plus',
    variant: 'outline',
  });
});

test('英文广告页同时保留购买和升级按钮', () => {
  const buttons = readButtons('en');

  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons[0], {
    title: 'Buy Now',
    url: 'https://fe.dtyuedan.cn/shop/F2OLER91/52wtgh',
    variant: 'default',
  });
  assert.deepEqual(buttons[1], {
    title: 'Upgrade Now',
    url: '/upgrade?source=ad-plus',
    variant: 'outline',
  });
});
