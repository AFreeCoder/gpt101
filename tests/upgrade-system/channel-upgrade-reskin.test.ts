import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

test('channel-upgrade 页面启用 channel variant 且套 .channel-skin', () => {
  const src = read('src/app/channel-upgrade/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin channel-tokens"/);
  // 不得触发 reseller 测试的禁用标记
  assert.doesNotMatch(src, /presentation="channel"/);
});

test('channel-upgrade 状态页同样启用 channel variant', () => {
  const src = read('src/app/channel-upgrade/status/[taskNo]/page.tsx');
  assert.match(src, /variant="channel"/);
  assert.match(src, /className="channel-skin channel-tokens"/);
});

test('UpgradeFlow channel 文案：标题改为 GPT Plus 自助升级', () => {
  const src = read('src/shared/blocks/upgrade/upgrade-flow.tsx');
  assert.match(src, /GPT Plus 自助升级/);
});

test('.channel-skin 主题样式已定义并接入 global.css', () => {
  const skin = read('src/config/style/channel-skin.css');
  assert.match(skin, /\.channel-skin\s*\{/);
  assert.match(skin, /\.channel-tokens\s*\{/);
  assert.match(skin, /--primary:\s*#c77c12/i);
  // 防回退：金底前景须为深色（白字对比度仅 3.32:1，不达 WCAG AA）
  assert.match(skin, /--primary-foreground:\s*#2a2316/i);
  const global = read('src/config/style/global.css');
  assert.match(global, /channel-skin\.css/);
});

test('弹窗 portal 只挂纯 token 类（不挂含 min-height 的整页 .channel-skin）', () => {
  const src = read('src/shared/blocks/upgrade/upgrade-flow.tsx');
  // DialogContent 必须用 channel-tokens，不能用会撑破弹窗的 channel-skin
  assert.match(src, /channel-tokens/);
  assert.doesNotMatch(src, /\? 'channel-skin'/);
});
