const UPGRADE_SUBDOMAIN_HOST = 'upgrade.gpt101.org';
const UPGRADE_PATH = '/upgrade';
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

export function getUpgradeSubdomainRedirectPath(
  host: string | null | undefined,
  pathname: string
): string | null {
  if (!isUpgradeSubdomainHost(host)) {
    return null;
  }

  const normalizedPathname = normalizePathname(pathname);
  const pathWithoutLocale = stripLeadingLocale(normalizedPathname);

  if (pathWithoutLocale === '/') {
    return UPGRADE_PATH;
  }

  if (
    normalizedPathname !== pathWithoutLocale &&
    isCanonicalUpgradePath(pathWithoutLocale)
  ) {
    return pathWithoutLocale;
  }

  if (pathWithoutLocale.startsWith('/status/')) {
    return `${UPGRADE_PATH}${pathWithoutLocale}`;
  }

  if (pathWithoutLocale === AGENT_UPGRADE_PATH) {
    return UPGRADE_PATH;
  }

  if (pathWithoutLocale.startsWith(`${AGENT_UPGRADE_PATH}/status/`)) {
    return `${UPGRADE_PATH}${pathWithoutLocale.slice(AGENT_UPGRADE_PATH.length)}`;
  }

  return null;
}

export function shouldServeUpgradeSubdomainPath(
  host: string | null | undefined,
  pathname: string
): boolean {
  if (!isUpgradeSubdomainHost(host)) {
    return false;
  }

  const normalizedPathname = normalizePathname(pathname);
  return (
    normalizedPathname === stripLeadingLocale(normalizedPathname) &&
    isCanonicalUpgradePath(normalizedPathname)
  );
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

function isCanonicalUpgradePath(pathname: string): boolean {
  return (
    pathname === UPGRADE_PATH || pathname.startsWith(`${UPGRADE_PATH}/status/`)
  );
}
