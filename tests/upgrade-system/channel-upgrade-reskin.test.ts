import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

test('channel-upgrade 页面启用 channel variant 且套 .channel-skin', () => {
  const src = read('src/app/channel-upgrade/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin"/);
  // 不得触发 reseller 测试的禁用标记
  assert.doesNotMatch(src, /presentation="channel"/);
});

test('channel-upgrade 状态页同样启用 channel variant', () => {
  const src = read('src/app/channel-upgrade/status/[taskNo]/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin"/);
});

test('UpgradeFlow channel 文案：标题改为 GPT Plus 自助升级', () => {
  const src = read('src/shared/blocks/upgrade/upgrade-flow.tsx');
  assert.match(src, /GPT Plus 自助升级/);
});

test('.channel-skin 主题样式已定义并接入 global.css', () => {
  const skin = read('src/config/style/channel-skin.css');
  assert.match(skin, /\.channel-skin\s*\{/);
  assert.match(skin, /--primary:\s*#c77c12/i);
  const global = read('src/config/style/global.css');
  assert.match(global, /channel-skin\.css/);
});
