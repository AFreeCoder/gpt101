'use client';

import { Zap } from 'lucide-react';

interface SideAd {
  title: string;
  description: string;
  tags: string[];
  button_text: string;
  footer_text: string;
  url: string;
  icon?: string;
  color?: 'orange' | 'blue';
}

interface HeroSideAdsProps {
  left?: SideAd;
  right?: SideAd;
}

function ClaudeIcon() {
  return (
    <svg viewBox="0 0 128 128" className="h-10 w-10" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M37.5 118C28.2 114.7 20 109.8 13 103.5C23.5 107.5 35 110 47 110C83.5 110 113.5 83 118 48C124.5 54.5 128 63.5 128 73C128 103.4 103.4 128 73 128C59.7 128 47.5 124 37.5 118Z"
        fill="currentColor"
        fillOpacity={0.3}
      />
      <path
        d="M64 0C28.7 0 0 28.7 0 64C0 81.3 6.9 97 18.2 108.6C12.7 96.6 9.8 83.2 10.9 69.1C13.2 41.6 34.6 18.7 61.9 14.8C90 10.8 116 32.5 116 61.2C116 61.8 116 62.4 116 63C123.5 54.8 128 43.9 128 32C128 14.3 113.7 0 96 0H64Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function AdCard({ ad, side }: { ad: SideAd; side: 'left' | 'right' }) {
  const isOrange = ad.color === 'orange';
  const gradientClass = isOrange ? 'from-orange-400 to-orange-500' : 'from-blue-500 to-blue-600';
  const iconBgClass = isOrange ? 'bg-orange-400' : 'bg-blue-500';
  const tagBgClass = isOrange ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200';
  const borderClass = isOrange ? 'border-orange-100' : 'border-blue-100';

  return (
    <div
      className={`absolute top-1/2 z-40 hidden w-[240px] -translate-y-1/2 transition-transform duration-300 hover:scale-105 xl:block ${
        side === 'left' ? 'left-4 lg:left-8' : 'right-4 lg:right-8'
      }`}
    >
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block overflow-hidden rounded-2xl border bg-white shadow-xl ${borderClass}`}
      >
        {/* 顶部渐变线 */}
        <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`} />

        <div className="p-4">
          {/* 头部 */}
          <div className="mb-5 flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ${iconBgClass}`}>
              {ad.icon === 'claude' ? <ClaudeIcon /> : <ApiIcon />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold leading-tight text-gray-900">{ad.title}</h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-medium text-green-700">在线</span>
              </div>
            </div>
          </div>

          {/* 描述区域 */}
          <div className="mb-4 flex min-h-[140px] items-center rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-medium leading-relaxed text-gray-700">{ad.description}</p>
          </div>

          {/* 标签 */}
          <div className="mb-5 flex flex-wrap gap-2">
            {ad.tags.map((tag, idx) => (
              <span key={idx} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tagBgClass}`}>
                ✓ {tag}
              </span>
            ))}
          </div>

          {/* 按钮 */}
          <div className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r py-3 text-center font-bold text-white shadow-md transition-all duration-300 hover:shadow-lg ${gradientClass}`}>
            <Zap className="h-5 w-5" />
            {ad.button_text}
          </div>

          {/* 底部文字 */}
          <div className="mt-3 text-center text-xs text-gray-600">{ad.footer_text}</div>
        </div>
      </a>
    </div>
  );
}

export function HeroSideAds({ left, right }: HeroSideAdsProps) {
  if (!left && !right) return null;

  return (
    <>
      {left && <AdCard ad={left} side="left" />}
      {right && <AdCard ad={right} side="right" />}
    </>
  );
}
