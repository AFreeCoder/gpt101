import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = envConfigs.app_url || 'https://gpt101.org';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/chatgpt-mirror`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-to-upgrade-gpt-plus`,
      lastModified: new Date('2025-09-30'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/chatgpt-mirror-guide`,
      lastModified: new Date('2025-10-02'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/2025-latest-7-way-to-upgrade-chatgpt-plus`,
      lastModified: new Date('2025-10-28'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/qf-dtyuedan-buy`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/lp/g/upgrade-chatgpt`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];
}
