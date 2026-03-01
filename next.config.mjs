import bundleAnalyzer from '@next/bundle-analyzer';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { createMDX } from 'fumadocs-mdx/next';
import createNextIntlPlugin from 'next-intl/plugin';

const withMDX = createMDX();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/core/i18n/request.ts',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  serverExternalPackages: ['@libsql/client', '@libsql/isomorphic-ws'],
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities: [60, 70, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
  },
  async redirects() {
    return [
      // 旧版 Astro 教程 URL → 新版 /tutorials/ 前缀 URL
      {
        source: '/chatgpt-mirror-guide',
        destination: '/tutorials/chatgpt-mirror-guide',
        permanent: true,
      },
      {
        source: '/how-to-upgrade-gpt-plus',
        destination: '/tutorials/how-to-upgrade-gpt-plus',
        permanent: true,
      },
      {
        source: '/2025-latest-7-way-to-upgrade-chatgpt-plus',
        destination: '/tutorials/2025-latest-7-way-to-upgrade-chatgpt-plus',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/imgs/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      // fs: {
      //   browser: './empty.ts', // We recommend to fix code imports before using this method
      // },
    },
  },
  experimental: {
    // mdxRs disabled for Cloudflare compatibility
  },
};

export default withBundleAnalyzer(withNextIntl(withMDX(nextConfig)));
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}
