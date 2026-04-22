import assert from 'node:assert/strict';
import test from 'node:test';

import { getUpgradeButtonAction } from '../../src/themes/default/blocks/gpt101-hero-actions';

test('getUpgradeButtonAction 有 url 时返回 link 动作', () => {
  assert.deepEqual(
    getUpgradeButtonAction({
      title: 'Upgrade Now',
      url: '/upgrade?source=home',
    }),
    {
      type: 'link',
      href: '/upgrade?source=home',
    }
  );
});

test('getUpgradeButtonAction 无 url 时回退 modal 动作', () => {
  assert.deepEqual(getUpgradeButtonAction({ title: 'Upgrade Now' }), {
    type: 'modal',
    href: null,
  });
});
