import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getAdPlusFunnelEventName,
  getUpgradeAttributionFromHref,
  resolveAdPlusSourceFromHref,
  shouldTrackAdPlusFunnel,
  trackAdPlusFunnelStep,
} from '../../src/shared/lib/ad-funnel';

test('only source=ad-plus enters ad funnel', () => {
  assert.equal(shouldTrackAdPlusFunnel('ad-plus'), true);
  assert.equal(shouldTrackAdPlusFunnel('home'), false);
  assert.equal(shouldTrackAdPlusFunnel(undefined), false);
  assert.equal(shouldTrackAdPlusFunnel(null), false);
});

test('ad-plus funnel event names are fixed', () => {
  assert.equal(getAdPlusFunnelEventName('upgrade'), 'ad_plus_click_upgrade');
  assert.equal(
    getAdPlusFunnelEventName('verify_code'),
    'ad_plus_click_verify_code'
  );
  assert.equal(
    getAdPlusFunnelEventName('verify_token'),
    'ad_plus_click_verify_token'
  );
});

test('resolveAdPlusSourceFromHref parses relative and absolute upgrade links', () => {
  assert.equal(
    resolveAdPlusSourceFromHref('/upgrade?source=ad-plus'),
    'ad-plus'
  );
  assert.equal(
    resolveAdPlusSourceFromHref('https://gpt101.org/upgrade?source=home'),
    'home'
  );
  assert.equal(resolveAdPlusSourceFromHref('/upgrade'), null);
  assert.equal(resolveAdPlusSourceFromHref(''), null);
});

test('getUpgradeAttributionFromHref extracts source and utm params', () => {
  assert.deepEqual(
    getUpgradeAttributionFromHref(
      '/upgrade?source=ad-plus&utm_source=google&utm_medium=cpc&utm_campaign=brand'
    ),
    {
      source: 'ad-plus',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'brand',
    }
  );
  assert.deepEqual(getUpgradeAttributionFromHref('/upgrade'), {});
});

test('trackAdPlusFunnelStep only sends upgrade event for ad-plus hero clicks', () => {
  const events: Array<{ name: string; params?: Record<string, unknown> }> = [];
  const conversions: Array<Record<string, unknown> | undefined> = [];

  assert.equal(
    trackAdPlusFunnelStep('home', 'upgrade', {
      sendEvent: (name, params) => {
        events.push({ name, params });
      },
      sendConversion: (params) => {
        conversions.push(params);
      },
    }),
    false
  );

  assert.deepEqual(events, []);
  assert.deepEqual(conversions, []);

  assert.equal(
    trackAdPlusFunnelStep('ad-plus', 'upgrade', {
      sendEvent: (name, params) => {
        events.push({ name, params });
      },
      sendConversion: (params) => {
        conversions.push(params);
      },
    }),
    true
  );

  assert.deepEqual(events, [
    {
      name: 'ad_plus_click_upgrade',
      params: {
        source: 'ad-plus',
        funnel_step: 'upgrade',
      },
    },
  ]);
  assert.deepEqual(conversions, []);
});

test('gpt101 hero wires ad-plus upgrade click tracking into the upgrade button', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/gpt101-hero.tsx'),
    'utf8'
  );

  assert.match(source, /trackAdPlusFunnelStep/);
  assert.match(source, /resolveAdPlusSourceFromHref/);
  assert.match(source, /'upgrade'/);
  assert.match(source, /sendGtagEvent/);
});
