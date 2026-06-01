// 内置的官方 upgrade 域名（命中后 /upgrade 会 rewrite 到 /channel-upgrade）
const DEFAULT_UPGRADE_PAGE_HOSTS = ['upgrade.gpt101.org', 'upgpt.app'];
const UPGRADE_PAGE_HOSTS_ENV = 'UPGRADE_PAGE_HOSTS';
const UPGRADE_PATH = '/upgrade';
const CHANNEL_UPGRADE_PATH = '/channel-upgrade';
const AGENT_UPGRADE_PATH = '/agent-upgrade';
const SUPPORTED_LOCALE_SEGMENTS = new Set(['en', 'zh']);

function normalizeHost(host: string | null | undefined): string {
  return (host || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
}

function getUpgradePageHosts(): Set<string> {
  const configuredHosts = (process.env[UPGRADE_PAGE_HOSTS_ENV] || '')
    .split(',')
    .map(normalizeHost)
    .filter(Boolean);

  return new Set([...DEFAULT_UPGRADE_PAGE_HOSTS, ...configuredHosts]);
}

export function isUpgradeSubdomainHost(
  host: string | null | undefined
): boolean {
  return getUpgradePageHosts().has(normalizeHost(host));
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

export function getUpgradeSubdomainRewritePath(
  host: string | null | undefined,
  pathname: string
): string | null {
  if (!shouldServeUpgradeSubdomainPath(host, pathname)) {
    return null;
  }

  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === UPGRADE_PATH) {
    return CHANNEL_UPGRADE_PATH;
  }

  if (normalizedPathname.startsWith(`${UPGRADE_PATH}/status/`)) {
    return `${CHANNEL_UPGRADE_PATH}${normalizedPathname.slice(UPGRADE_PATH.length)}`;
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

function isCanonicalUpgradePath(pathname: string): boolean {
  return (
    pathname === UPGRADE_PATH || pathname.startsWith(`${UPGRADE_PATH}/status/`)
  );
}
