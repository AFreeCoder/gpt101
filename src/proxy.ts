import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/core/i18n/config';
import {
  getUpgradeSubdomainRedirectPath,
  shouldServeUpgradeSubdomainPath,
} from '@/shared/lib/upgrade-subdomain';

const intlMiddleware = createIntlMiddleware(routing);
const PUBLIC_CACHE_CONTROL =
  'public, s-maxage=3600, stale-while-revalidate=14400';
const QUERY_ROBOTS_HEADER = 'noindex, follow';

function withPublicCacheHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-url', request.url);
  response.headers.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  response.headers.set('CDN-Cache-Control', PUBLIC_CACHE_CONTROL);
  response.headers.set('Cloudflare-CDN-Cache-Control', PUBLIC_CACHE_CONTROL);
  return applyQueryRobotsHeader(response, request);
}

function applyQueryRobotsHeader(response: NextResponse, request: NextRequest) {
  if (request.nextUrl.searchParams.has('q')) {
    response.headers.set('X-Robots-Tag', QUERY_ROBOTS_HEADER);
  }

  return response;
}

function createUpgradeSubdomainRedirectUrl(
  request: NextRequest,
  pathname: string
) {
  const forwardedHost = getForwardedHeaderValue(request, 'x-forwarded-host');
  const forwardedProto = getForwardedHeaderValue(request, 'x-forwarded-proto');
  const host =
    forwardedHost || request.headers.get('host') || request.nextUrl.host;
  const protocol = normalizeProtocol(
    forwardedProto || request.nextUrl.protocol
  );

  return new URL(
    `${pathname}${request.nextUrl.search}`,
    `${protocol}://${host}`
  );
}

function getForwardedHeaderValue(request: NextRequest, headerName: string) {
  const value = request.headers.get(headerName);
  return value?.split(',')[0]?.trim() || null;
}

function normalizeProtocol(protocol: string) {
  return protocol.endsWith(':') ? protocol.slice(0, -1) : protocol;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');

  const upgradeSubdomainRedirectPath = getUpgradeSubdomainRedirectPath(
    host,
    pathname
  );
  if (upgradeSubdomainRedirectPath) {
    return NextResponse.redirect(
      createUpgradeSubdomainRedirectUrl(request, upgradeSubdomainRedirectPath)
    );
  }

  if (shouldServeUpgradeSubdomainPath(host, pathname)) {
    return withPublicCacheHeaders(NextResponse.next(), request);
  }

  // Handle internationalization first
  const intlResponse = intlMiddleware(request);

  // Extract locale from pathname
  const locale = pathname.split('/')[1];
  const isValidLocale = routing.locales.includes(locale as any);
  const pathWithoutLocale = isValidLocale
    ? pathname.slice(locale.length + 1)
    : pathname;

  // Only check authentication for admin routes
  if (
    pathWithoutLocale.startsWith('/admin') ||
    pathWithoutLocale.startsWith('/settings') ||
    pathWithoutLocale.startsWith('/activity')
  ) {
    // Check if session cookie exists
    const sessionCookie = getSessionCookie(request);

    // If no session token found, redirect to sign-in
    if (!sessionCookie) {
      const signInUrl = new URL(
        isValidLocale ? `/${locale}/sign-in` : '/sign-in',
        request.url
      );
      // Add the current path (including search params) as callback - use relative path for multi-language support
      const callbackPath = pathWithoutLocale + request.nextUrl.search;
      signInUrl.searchParams.set('callbackUrl', callbackPath);
      return NextResponse.redirect(signInUrl);
    }

    // For admin routes, we need to check RBAC permissions
    // Note: Full permission check happens in the page/API route level
    // This is a lightweight session check to prevent unauthorized access
    // The detailed permission check (admin.access and specific permissions)
    // will be done in the layout or individual pages using requirePermission()
  }

  intlResponse.headers.set('x-pathname', request.nextUrl.pathname);
  intlResponse.headers.set('x-url', request.url);

  // Remove Set-Cookie from public pages to allow caching
  // We exclude admin, settings, activity, and auth pages from this behavior
  if (
    !pathWithoutLocale.startsWith('/admin') &&
    !pathWithoutLocale.startsWith('/settings') &&
    !pathWithoutLocale.startsWith('/activity') &&
    !pathWithoutLocale.startsWith('/sign-') &&
    !pathWithoutLocale.startsWith('/auth')
  ) {
    intlResponse.headers.delete('Set-Cookie');

    // Cache-Control header for public pages
    intlResponse.headers.set('Cache-Control', PUBLIC_CACHE_CONTROL);
    intlResponse.headers.set('CDN-Cache-Control', PUBLIC_CACHE_CONTROL);
    intlResponse.headers.set(
      'Cloudflare-CDN-Cache-Control',
      PUBLIC_CACHE_CONTROL
    );
    applyQueryRobotsHeader(intlResponse, request);
  }

  // For all other routes (including /, /sign-in, /sign-up, /sign-out), just return the intl response
  return intlResponse;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
