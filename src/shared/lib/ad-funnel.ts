import type { GoogleAdsConversionAction } from './gtag';

export type AdPlusFunnelStep = 'upgrade' | 'verify_code' | 'verify_token';

export type UpgradeAttributionParams = {
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type TrackAdPlusFunnelStepOptions = {
  sendEvent: (eventName: string, params?: Record<string, unknown>) => void;
  sendConversion?: (params?: Record<string, unknown>) => void;
};

const AD_PLUS_SOURCE = 'ad-plus';
const AD_PLUS_LANDING_PATH = '/lp/g/upgrade-chatgpt';
const AD_PLUS_ENTRY_STORAGE_KEY = 'gpt101:ad-plus-upgrade-entry';
const AD_PLUS_ENTRY_TTL_MS = 2 * 60 * 60 * 1000;

const AD_PLUS_EVENT_MAP: Record<AdPlusFunnelStep, string> = {
  upgrade: 'ad_plus_click_upgrade',
  verify_code: 'ad_plus_click_verify_code',
  verify_token: 'ad_plus_click_verify_token',
};

const AD_PLUS_CONVERSION_ACTION_MAP: Record<
  AdPlusFunnelStep,
  GoogleAdsConversionAction
> = {
  upgrade: 'start_upgrade',
  verify_code: 'card_verify',
  verify_token: 'token_verify',
};

export function shouldTrackAdPlusFunnel(source?: string | null) {
  return source === AD_PLUS_SOURCE;
}

export function getAdPlusFunnelEventName(step: AdPlusFunnelStep) {
  return AD_PLUS_EVENT_MAP[step];
}

export function getAdPlusFunnelConversionAction(step: AdPlusFunnelStep) {
  return AD_PLUS_CONVERSION_ACTION_MAP[step];
}

export function shouldSendAdPlusConversion(step: AdPlusFunnelStep) {
  return Boolean(getAdPlusFunnelConversionAction(step));
}

export function resolveAdPlusSourceFromHref(
  href?: string | null,
  baseUrl = 'https://gpt101.org'
) {
  return getUpgradeAttributionFromHref(href, baseUrl).source ?? null;
}

export function getUpgradeAttributionFromHref(
  href?: string | null,
  baseUrl = 'https://gpt101.org'
): UpgradeAttributionParams {
  if (!href) {
    return {};
  }

  try {
    const searchParams = new URL(href, baseUrl).searchParams;
    const attribution: UpgradeAttributionParams = {};

    const source = searchParams.get('source');
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    if (source) attribution.source = source;
    if (utmSource) attribution.utm_source = utmSource;
    if (utmMedium) attribution.utm_medium = utmMedium;
    if (utmCampaign) attribution.utm_campaign = utmCampaign;

    return attribution;
  } catch {
    return {};
  }
}

export function isAdPlusLandingPath(pathname?: string | null) {
  if (!pathname) return false;

  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized === AD_PLUS_LANDING_PATH ||
    normalized.endsWith(AD_PLUS_LANDING_PATH)
  );
}

export function markAdPlusUpgradeEntryFromLanding(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  if (!isAdPlusLandingPath(window.location.pathname)) return false;

  try {
    window.sessionStorage.setItem(
      AD_PLUS_ENTRY_STORAGE_KEY,
      JSON.stringify({
        source: AD_PLUS_SOURCE,
        landing_path: AD_PLUS_LANDING_PATH,
        started_at: now,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function hasAdPlusUpgradeEntryFromLanding(now = Date.now()) {
  if (typeof window === 'undefined') return false;

  try {
    const raw = window.sessionStorage.getItem(AD_PLUS_ENTRY_STORAGE_KEY);
    if (!raw) return false;

    const entry = JSON.parse(raw);
    return (
      entry?.source === AD_PLUS_SOURCE &&
      entry?.landing_path === AD_PLUS_LANDING_PATH &&
      typeof entry?.started_at === 'number' &&
      now - entry.started_at >= 0 &&
      now - entry.started_at <= AD_PLUS_ENTRY_TTL_MS
    );
  } catch {
    return false;
  }
}

export function trackAdPlusFunnelStep(
  source: string | null | undefined,
  step: AdPlusFunnelStep,
  options: TrackAdPlusFunnelStepOptions
) {
  if (!shouldTrackAdPlusFunnel(source)) {
    return false;
  }

  const params = {
    source: AD_PLUS_SOURCE,
    funnel_step: step,
  };

  options.sendEvent(getAdPlusFunnelEventName(step), params);

  if (shouldSendAdPlusConversion(step)) {
    options.sendConversion?.(
      step === 'verify_token' ? { ...params, transaction_id: '' } : params
    );
  }

  return true;
}
