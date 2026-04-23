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

const AD_PLUS_EVENT_MAP: Record<AdPlusFunnelStep, string> = {
  upgrade: 'ad_plus_click_upgrade',
  verify_code: 'ad_plus_click_verify_code',
  verify_token: 'ad_plus_click_verify_token',
};

export function shouldTrackAdPlusFunnel(source?: string | null) {
  return source === AD_PLUS_SOURCE;
}

export function getAdPlusFunnelEventName(step: AdPlusFunnelStep) {
  return AD_PLUS_EVENT_MAP[step];
}

export function shouldSendAdPlusConversion(step: AdPlusFunnelStep) {
  return step === 'verify_token';
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
    options.sendConversion?.(params);
  }

  return true;
}
