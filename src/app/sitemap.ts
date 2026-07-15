import { MetadataRoute } from 'next';

import { defaultLocale, locales } from '@/config/locale';
import {
  getLocalizedUrl,
  TUTORIAL_CONTENT_LOCALE,
} from '@/shared/lib/seo-routing';
import { getSeoSiteUrl } from '@/shared/lib/seo-site-url';

// 生产镜像在构建完成后才通过容器环境注入默认语言。
// sitemap 必须在运行时生成，否则会固化构建机的英文默认值。
export const dynamic = 'force-dynamic';

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]['changeFrequency']
>;

type PublicPage = {
  pathname: string;
  changeFrequency: ChangeFrequency;
  priority: number;
};

const localizedPublicPages: PublicPage[] = [
  { pathname: '/', changeFrequency: 'daily', priority: 1 },
  { pathname: '/chatgpt-mirror', changeFrequency: 'weekly', priority: 0.9 },
  { pathname: '/faq', changeFrequency: 'weekly', priority: 0.8 },
  {
    pathname: '/lp/g/upgrade-chatgpt',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  { pathname: '/privacy-policy', changeFrequency: 'yearly', priority: 0.4 },
  {
    pathname: '/terms-of-service',
    changeFrequency: 'yearly',
    priority: 0.4,
  },
];

const tutorialPages = [
  {
    pathname: '/tutorials',
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  },
  {
    pathname: '/tutorials/how-to-upgrade-gpt-plus',
    lastModified: new Date('2025-09-30'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  },
  {
    pathname: '/tutorials/chatgpt-mirror-guide',
    lastModified: new Date('2025-10-02'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSeoSiteUrl();

  const localizedEntries = localizedPublicPages.flatMap((page) => {
    const languages = Object.fromEntries(
      locales.map((locale) => [
        locale,
        getLocalizedUrl(baseUrl, page.pathname, locale, defaultLocale),
      ])
    );

    return locales.map((locale) => ({
      url: getLocalizedUrl(baseUrl, page.pathname, locale, defaultLocale),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });

  const tutorialEntries = tutorialPages.map((page) => ({
    url: getLocalizedUrl(
      baseUrl,
      page.pathname,
      TUTORIAL_CONTENT_LOCALE,
      defaultLocale
    ),
    ...(page.lastModified ? { lastModified: page.lastModified } : {}),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  return [...localizedEntries, ...tutorialEntries];
}
