import { envConfigs } from '@/config';

const DEFAULT_SITE_URL = 'https://gpt101.org';

export function getSeoSiteUrl() {
  const configuredUrl = envConfigs.app_url;

  if (!configuredUrl || configuredUrl.includes('localhost')) {
    return DEFAULT_SITE_URL;
  }

  return configuredUrl.replace(/\/$/, '');
}
