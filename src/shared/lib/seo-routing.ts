export const TUTORIAL_CONTENT_LOCALE = 'zh';

export type LocalizedPath = {
  locale: string;
  pathWithoutLocale: string;
  hasLocalePrefix: boolean;
};

function normalizePathname(pathname: string) {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash || '/';
}

export function parseLocalizedPath(
  pathname: string,
  defaultLocale: string,
  supportedLocales: readonly string[]
): LocalizedPath {
  const normalizedPathname = normalizePathname(pathname);
  const segments = normalizedPathname.split('/');
  const localePrefix = segments[1] || '';
  const hasLocalePrefix = supportedLocales.includes(localePrefix);
  const pathWithoutLocale = hasLocalePrefix
    ? normalizePathname(`/${segments.slice(2).join('/')}`)
    : normalizedPathname;

  return {
    locale: hasLocalePrefix ? localePrefix : defaultLocale,
    pathWithoutLocale,
    hasLocalePrefix,
  };
}

export function getLocalizedPathname(
  pathname: string,
  locale: string,
  defaultLocale: string
) {
  const normalizedPathname = normalizePathname(pathname);

  if (locale === defaultLocale) {
    return normalizedPathname;
  }

  return normalizedPathname === '/'
    ? `/${locale}`
    : `/${locale}${normalizedPathname}`;
}

export function getLocalizedUrl(
  baseUrl: string,
  pathname: string,
  locale: string,
  defaultLocale: string
) {
  const localizedPathname = getLocalizedPathname(
    pathname,
    locale,
    defaultLocale
  );
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return localizedPathname === '/'
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${localizedPathname}`;
}

export function isTutorialPath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return (
    normalizedPathname === '/tutorials' ||
    normalizedPathname.startsWith('/tutorials/')
  );
}

export function getTutorialLocaleRedirectPath(
  pathname: string,
  defaultLocale: string,
  supportedLocales: readonly string[]
) {
  const localizedPath = parseLocalizedPath(
    pathname,
    defaultLocale,
    supportedLocales
  );

  if (
    !isTutorialPath(localizedPath.pathWithoutLocale) ||
    localizedPath.locale === TUTORIAL_CONTENT_LOCALE
  ) {
    return null;
  }

  return getLocalizedPathname(
    localizedPath.pathWithoutLocale,
    TUTORIAL_CONTENT_LOCALE,
    defaultLocale
  );
}

function matchesPathGroup(pathname: string, basePath: string) {
  const normalizedPathname = normalizePathname(pathname);
  return (
    normalizedPathname === basePath ||
    normalizedPathname.startsWith(`${basePath}/`)
  );
}

export function shouldSuppressAlternateLinks(pathname: string) {
  return (
    isTutorialPath(pathname) ||
    matchesPathGroup(pathname, '/upgrade') ||
    matchesPathGroup(pathname, '/chat')
  );
}
