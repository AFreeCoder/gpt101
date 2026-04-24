const UPGRADE_SUBDOMAIN_HOST = 'upgrade.gpt101.org';
const AGENT_UPGRADE_PATH = '/agent-upgrade';
const SUPPORTED_LOCALE_SEGMENTS = new Set(['en', 'zh']);

function normalizeHost(host: string | null | undefined): string {
  return (host || '').split(':')[0].toLowerCase();
}

export function isUpgradeSubdomainHost(
  host: string | null | undefined
): boolean {
  return normalizeHost(host) === UPGRADE_SUBDOMAIN_HOST;
}

export function getUpgradeSubdomainRewritePath(
  host: string | null | undefined,
  pathname: string
): string | null {
  if (!isUpgradeSubdomainHost(host)) {
    return null;
  }

  const normalizedPathname = normalizePathname(pathname);
  const pathWithoutLocale = stripLeadingLocale(normalizedPathname);

  if (pathWithoutLocale === '/' || pathWithoutLocale === '/upgrade') {
    return AGENT_UPGRADE_PATH;
  }

  if (pathWithoutLocale.startsWith('/status/')) {
    return `${AGENT_UPGRADE_PATH}${pathWithoutLocale}`;
  }

  if (pathWithoutLocale.startsWith('/upgrade/status/')) {
    return `${AGENT_UPGRADE_PATH}${pathWithoutLocale.slice('/upgrade'.length)}`;
  }

  return null;
}

export function shouldSkipGlobalCustomerService(
  host: string | null | undefined
): boolean {
  return isUpgradeSubdomainHost(host);
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function stripLeadingLocale(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];

  if (!SUPPORTED_LOCALE_SEGMENTS.has(maybeLocale)) {
    return pathname;
  }

  const stripped = `/${segments.slice(2).join('/')}`;
  return stripped === '/' ? '/' : normalizePathname(stripped);
}
