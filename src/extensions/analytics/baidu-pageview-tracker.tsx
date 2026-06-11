'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    _hmt?: Array<unknown[]>;
  }
}

function getTrackedPath(
  pathname: string | null,
  searchParams: URLSearchParams
) {
  const path = pathname || '/';
  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
}

export function BaiduPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = getTrackedPath(pathname, searchParams);

    if (previousPathRef.current === null) {
      previousPathRef.current = currentPath;
      return;
    }

    if (previousPathRef.current === currentPath) {
      return;
    }

    previousPathRef.current = currentPath;
    window._hmt = window._hmt || [];
    window._hmt.push(['_trackPageview', currentPath]);
  }, [pathname, searchParams]);

  return null;
}
