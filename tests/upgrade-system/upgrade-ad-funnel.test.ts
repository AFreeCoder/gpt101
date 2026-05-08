import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { trackAdPlusFunnelStep } from '../../src/shared/lib/ad-funnel';

test('trackAdPlusFunnelStep sends verify code event and card-verify conversion', () => {
  const events: Array<{ name: string; params?: Record<string, unknown> }> = [];
  const conversions: Array<Record<string, unknown> | undefined> = [];

  assert.equal(
    trackAdPlusFunnelStep('ad-plus', 'verify_code', {
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
      name: 'ad_plus_click_verify_code',
      params: {
        source: 'ad-plus',
        funnel_step: 'verify_code',
      },
    },
  ]);
  assert.deepEqual(conversions, [
    {
      source: 'ad-plus',
      funnel_step: 'verify_code',
    },
  ]);
});

test('trackAdPlusFunnelStep sends verify token event and Google Ads conversion together', () => {
  const events: Array<{ name: string; params?: Record<string, unknown> }> = [];
  const conversions: Array<Record<string, unknown> | undefined> = [];

  assert.equal(
    trackAdPlusFunnelStep('ad-plus', 'verify_token', {
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
      name: 'ad_plus_click_verify_token',
      params: {
        source: 'ad-plus',
        funnel_step: 'verify_token',
      },
    },
  ]);
  assert.deepEqual(conversions, [
    {
      source: 'ad-plus',
      funnel_step: 'verify_token',
      transaction_id: '',
    },
  ]);
});

test('upgrade page tracks ad-plus verify clicks on button press instead of waiting for API success', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/shared/blocks/upgrade/upgrade-flow.tsx'),
    'utf8'
  );
  const pageSource = readFileSync(
    path.join(process.cwd(), 'src/app/[locale]/(landing)/upgrade/page.tsx'),
    'utf8'
  );

  assert.match(pageSource, /UpgradeFlow/);
  assert.match(source, /resolveAdPlusSourceFromHref\(window\.location\.href\)/);
  assert.match(source, /hasAdPlusUpgradeEntryFromLanding\(\)/);
  assert.match(source, /trackAdPlusFunnelStep\(source,\s*step,/);
  assert.match(
    source,
    /onClick=\{\(\) => \{\s*trackAdPlusStep\('verify_code'\);\s*void handleVerifyCode\(\);?\s*\}\}/
  );
  assert.match(
    source,
    /onClick=\{\(\) => \{\s*trackAdPlusStep\('verify_token'\);\s*void handleParseToken\(\);?\s*\}\}/
  );
  assert.match(source, /sendGoogleAdsConversionAction/);
  assert.match(source, /getAdPlusFunnelConversionAction\(step\)/);
  assert.match(source, /getUpgradeAttributionFromHref/);
  assert.match(source, /\.\.\.attribution/);
});
