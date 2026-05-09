import { MetadataRoute } from 'next';

import { getSeoSiteUrl } from '@/shared/lib/seo-site-url';

export default function robots(): MetadataRoute.Robots {
  const appUrl = getSeoSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/privacy-policy',
        '/terms-of-service',
        '/settings/*',
        '/activity/*',
        '/admin/*',
        '/api/*',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
