import { generateSitemapXml } from '~/utils/sitemap';

export async function GET() {
  const body = await generateSitemapXml();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
