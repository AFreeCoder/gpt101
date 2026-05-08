import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  getAdPlusFunnelConversionAction,
  getAdPlusFunnelEventName,
  getUpgradeAttributionFromHref,
  hasAdPlusUpgradeEntryFromLanding,
  isAdPlusLandingPath,
  markAdPlusUpgradeEntryFromLanding,
  resolveAdPlusSourceFromHref,
  shouldTrackAdPlusFunnel,
  trackAdPlusFunnelStep,
} from '../../src/shared/lib/ad-funnel';
import {
  getGoogleAdsConversionSendTo,
  sendGoogleAdsConversionAction,
  sendOutboundClick,
} from '../../src/shared/lib/gtag';

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

test('ad-plus funnel steps map to dedicated Google Ads conversion actions', () => {
  assert.equal(getAdPlusFunnelConversionAction('upgrade'), 'start_upgrade');
  assert.equal(getAdPlusFunnelConversionAction('verify_code'), 'card_verify');
  assert.equal(getAdPlusFunnelConversionAction('verify_token'), 'token_verify');
  assert.equal(
    getGoogleAdsConversionSendTo('outbound_buy'),
    'AW-17885221737/JGUYCKiX7uobEOmmq9BC'
  );
  assert.equal(
    getGoogleAdsConversionSendTo('start_upgrade'),
    'AW-17885221737/eQl9CNy376kcEOmmq9BC'
  );
  assert.equal(
    getGoogleAdsConversionSendTo('card_verify'),
    'AW-17885221737/VurcCIDn1akcEOmmq9BC'
  );
  assert.equal(
    getGoogleAdsConversionSendTo('token_verify'),
    'AW-17885221737/JCCTCL6M76kcEOmmq9BC'
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

test('trackAdPlusFunnelStep sends upgrade event and start-upgrade conversion for ad-plus hero clicks', () => {
  const ignoredEvents: Array<{
    name: string;
    params?: Record<string, unknown>;
  }> = [];
  const ignoredConversions: Array<Record<string, unknown> | undefined> = [];

  assert.equal(
    trackAdPlusFunnelStep('home', 'upgrade', {
      sendEvent: (name, params) => {
        ignoredEvents.push({ name, params });
      },
      sendConversion: (params) => {
        ignoredConversions.push(params);
      },
    }),
    false
  );

  assert.deepEqual(ignoredEvents, []);
  assert.deepEqual(ignoredConversions, []);

  const events: Array<{ name: string; params?: Record<string, unknown> }> = [];
  const conversions: Array<Record<string, unknown> | undefined> = [];

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
  assert.deepEqual(conversions, [
    {
      source: 'ad-plus',
      funnel_step: 'upgrade',
    },
  ]);
});

test('ad-plus upgrade entry marker is written only from the ad landing page', () => {
  const storage = new Map<string, string>();
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {
    location: { pathname: '/lp/g/upgrade-chatgpt' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };

  try {
    assert.equal(markAdPlusUpgradeEntryFromLanding(), true);
    assert.equal(storage.size, 1);

    storage.clear();
    (globalThis as any).window.location.pathname = '/';
    assert.equal(markAdPlusUpgradeEntryFromLanding(), false);
    assert.equal(storage.size, 0);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('ad-plus landing path accepts localized route and rejects adjacent pages', () => {
  assert.equal(isAdPlusLandingPath('/lp/g/upgrade-chatgpt'), true);
  assert.equal(isAdPlusLandingPath('/zh/lp/g/upgrade-chatgpt'), true);
  assert.equal(isAdPlusLandingPath('/en/lp/g/upgrade-chatgpt/'), true);
  assert.equal(isAdPlusLandingPath('/lp/g/upgrade-chatgpt-copy'), false);
  assert.equal(isAdPlusLandingPath('/upgrade'), false);
});

test('ad-plus upgrade entry marker expires and rejects malformed storage', () => {
  const storage = new Map<string, string>();
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {
    location: { pathname: '/lp/g/upgrade-chatgpt' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  };

  try {
    assert.equal(markAdPlusUpgradeEntryFromLanding(1_000), true);
    assert.equal(hasAdPlusUpgradeEntryFromLanding(1_000), true);
    assert.equal(
      hasAdPlusUpgradeEntryFromLanding(1_000 + 2 * 60 * 60 * 1000),
      true
    );
    assert.equal(
      hasAdPlusUpgradeEntryFromLanding(1_001 + 2 * 60 * 60 * 1000),
      false
    );

    storage.set('gpt101:ad-plus-upgrade-entry', '{not-json');
    assert.equal(hasAdPlusUpgradeEntryFromLanding(1_000), false);

    storage.set(
      'gpt101:ad-plus-upgrade-entry',
      JSON.stringify({
        source: 'ad-plus',
        landing_path: '/upgrade',
        started_at: 1_000,
      })
    );
    assert.equal(hasAdPlusUpgradeEntryFromLanding(1_000), false);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Google Ads conversion actions emit the exact send_to labels', () => {
  const sent: Array<[string, string, Record<string, unknown>]> = [];
  const originalWindow = (globalThis as any).window;
  const originalSetTimeout = globalThis.setTimeout;
  (globalThis as any).window = {
    gtag: (...args: [string, string, Record<string, unknown>]) => {
      sent.push(args);
    },
  };
  (globalThis as any).setTimeout = () => 0;

  try {
    sendOutboundClick('https://fe.dtyuedan.cn/shop/F2OLER91/g2kxdj');
    sendGoogleAdsConversionAction('start_upgrade', undefined, {
      source: 'ad-plus',
      funnel_step: 'upgrade',
    });
    sendGoogleAdsConversionAction('card_verify', undefined, {
      source: 'ad-plus',
      funnel_step: 'verify_code',
    });
    sendGoogleAdsConversionAction('token_verify', undefined, {
      source: 'ad-plus',
      funnel_step: 'verify_token',
      transaction_id: '',
    });

    assert.equal(sent.length, 4);
    assert.deepEqual(
      sent.map(([, eventName, params]) => [eventName, params.send_to]),
      [
        ['conversion', 'AW-17885221737/JGUYCKiX7uobEOmmq9BC'],
        ['conversion', 'AW-17885221737/eQl9CNy376kcEOmmq9BC'],
        ['conversion', 'AW-17885221737/VurcCIDn1akcEOmmq9BC'],
        ['conversion', 'AW-17885221737/JCCTCL6M76kcEOmmq9BC'],
      ]
    );
    assert.equal(sent[3][2].transaction_id, '');
    assert.equal(typeof sent[3][2].event_callback, 'function');
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).setTimeout = originalSetTimeout;
  }
});

test('gpt101 hero wires ad-plus upgrade click tracking into the upgrade button', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/themes/default/blocks/gpt101-hero.tsx'),
    'utf8'
  );

  assert.match(source, /trackAdPlusFunnelStep/);
  assert.match(source, /resolveAdPlusSourceFromHref/);
  assert.match(source, /markAdPlusUpgradeEntryFromLanding/);
  assert.match(source, /sendGoogleAdsConversionAction/);
  assert.match(source, /'upgrade'/);
  assert.match(source, /sendGtagEvent/);
});
