import assert from 'node:assert/strict';
import test from 'node:test';

import { getAnalyticsManagerWithConfigs } from '../../src/shared/services/analytics';
import { getSettings } from '../../src/shared/services/settings';

test('analytics settings include baidu analytics id', async () => {
  const settings = await getSettings();
  const baiduAnalyticsId = settings.find(
    (setting) => setting.name === 'baidu_analytics_id'
  );

  assert.ok(baiduAnalyticsId);
  assert.equal(baiduAnalyticsId.group, 'baidu_analytics');
  assert.equal(baiduAnalyticsId.tab, 'analytics');
});

test('baidu analytics registers head script and client pageview tracker', () => {
  const analytics = getAnalyticsManagerWithConfigs({
    baidu_analytics_id: 'test-baidu-id',
  });
  const headScripts = analytics.getHeadScripts();
  const bodyScripts = analytics.getBodyScripts();

  assert.ok(Array.isArray(headScripts));
  assert.ok(Array.isArray(bodyScripts));
  assert.equal(headScripts.length, 1);
  assert.equal(bodyScripts.length, 1);
});
