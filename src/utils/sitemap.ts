import {
  fetchPosts,
  blogPostsPerPage,
  isBlogEnabled,
  isBlogListRouteEnabled,
  isBlogCategoryRouteEnabled,
  isBlogTagRouteEnabled,
} from '~/utils/blog';
import { BLOG_BASE, CATEGORY_BASE, TAG_BASE, getCanonical, getPermalink, trimSlash } from '~/utils/permalinks';

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

const staticPageFiles = Object.keys(import.meta.glob('../pages/**/*.{astro,md,mdx}', { eager: false }));

const joinSegments = (...segments: Array<string | number | undefined>) =>
  segments
    .filter((segment) => segment !== undefined && segment !== '')
    .map((segment) => trimSlash(String(segment)))
    .filter(Boolean)
    .join('/');

const normalizeStaticRoute = (filePath: string): string | null => {
  let normalized = filePath.replace('../pages/', '');
  if (normalized.startsWith('_') || normalized.includes('/_')) return null;
  if (normalized.includes('[') || normalized.includes(']')) return null;
  normalized = normalized.replace(/\.(astro|md|mdx)$/i, '');

  if (!normalized || normalized === 'index') return '/';
  if (normalized === '404') return null;

  if (normalized.endsWith('/index')) {
    normalized = normalized.slice(0, -'/index'.length);
  }

  return '/' + trimSlash(normalized);
};

const collectStaticRoutes = (): string[] =>
  Array.from(new Set(staticPageFiles.map(normalizeStaticRoute).filter((route): route is string => Boolean(route))));

const toLastmod = (dates: Date[]): string | undefined => {
  if (!dates.length) return undefined;
  const latest = dates.reduce((latestDate, current) => (current > latestDate ? current : latestDate), dates[0]);
  return latest.toISOString();
};

const addEntry = (entries: Map<string, SitemapEntry>, path: string, lastModified?: Date | Date[]) => {
  if (!path) return;
  const canonical = String(getCanonical(path));
  const lastmodDate = Array.isArray(lastModified) ? toLastmod(lastModified) : lastModified?.toISOString();

  const existing = entries.get(canonical);
  if (!existing || (lastmodDate && (!existing.lastmod || lastmodDate > existing.lastmod))) {
    entries.set(canonical, { loc: canonical, lastmod: lastmodDate });
  }
};

const collectSitemapEntries = async (): Promise<SitemapEntry[]> => {
  const entries = new Map<string, SitemapEntry>();

  collectStaticRoutes().forEach((route) => addEntry(entries, route));

  if (isBlogEnabled) {
    const posts = await fetchPosts();
    const postDates = posts
      .map((post) => post.updateDate || post.publishDate)
      .filter((date): date is Date => Boolean(date));
    const latestPostDate = postDates.length
      ? postDates.reduce((latest, current) => (current > latest ? current : latest))
      : undefined;
    const pageSize = Math.max(1, blogPostsPerPage || posts.length || 1);

    posts.forEach((post) => {
      addEntry(entries, getPermalink(post.permalink, 'post'), post.updateDate || post.publishDate);
    });

    if (isBlogListRouteEnabled && BLOG_BASE) {
      const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
      for (let page = 1; page <= totalPages; page++) {
        const path = page === 1 ? getPermalink(BLOG_BASE, 'blog') : getPermalink(joinSegments(BLOG_BASE, page));
        addEntry(entries, path, latestPostDate);
      }
    }

    if (isBlogCategoryRouteEnabled) {
      const categoryPosts = new Map<string, Date[]>();
      posts.forEach((post) => {
        const slug = post.category?.slug;
        const timestamp = post.updateDate || post.publishDate;
        if (!slug || !timestamp) return;
        const dates = categoryPosts.get(slug) || [];
        dates.push(timestamp);
        categoryPosts.set(slug, dates);
      });

      categoryPosts.forEach((dates, slug) => {
        const totalPages = Math.max(1, Math.ceil(dates.length / pageSize));
        for (let page = 1; page <= totalPages; page++) {
          const path =
            page === 1 ? getPermalink(slug, 'category') : getPermalink(joinSegments(CATEGORY_BASE, slug, page));
          addEntry(entries, path, dates);
        }
      });
    }

    if (isBlogTagRouteEnabled) {
      const tagPosts = new Map<string, Date[]>();
      posts.forEach((post) => {
        post.tags?.forEach((tag) => {
          const timestamp = post.updateDate || post.publishDate;
          if (!tag?.slug || !timestamp) return;
          const dates = tagPosts.get(tag.slug) || [];
          dates.push(timestamp);
          tagPosts.set(tag.slug, dates);
        });
      });

      tagPosts.forEach((dates, slug) => {
        const totalPages = Math.max(1, Math.ceil(dates.length / pageSize));
        for (let page = 1; page <= totalPages; page++) {
          const path = page === 1 ? getPermalink(slug, 'tag') : getPermalink(joinSegments(TAG_BASE, slug, page));
          addEntry(entries, path, dates);
        }
      });
    }
  }

  return Array.from(entries.values()).sort((a, b) => a.loc.localeCompare(b.loc));
};

export const generateSitemapXml = async (): Promise<string> => {
  const items = await collectSitemapEntries();

  const urls = items
    .map((item) => {
      const lastmod = item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${item.loc}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

export const generateSitemapIndexXml = async (): Promise<string> => {
  const items = await collectSitemapEntries();
  const sitemapLoc = getCanonical('/sitemap.xml');
  const latest = items.reduce<string | undefined>((acc, item) => {
    if (!item.lastmod) return acc;
    if (!acc || item.lastmod > acc) return item.lastmod;
    return acc;
  }, undefined);

  const lastmod = latest ? `\n    <lastmod>${latest}</lastmod>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${sitemapLoc}</loc>${lastmod}\n  </sitemap>\n</sitemapindex>\n`;
};
