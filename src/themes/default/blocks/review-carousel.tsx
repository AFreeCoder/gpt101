'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

export function ReviewCarousel({ section }: { section: Section }) {
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const images = section.items || [];
  const rowTop = images.filter((_: unknown, i: number) => i % 2 === 0);
  const rowBottom = images.filter((_: unknown, i: number) => i % 2 === 1);
  const topLoop = [...rowTop, ...rowTop];
  const bottomLoop = [...(rowBottom.length > 0 ? rowBottom : images), ...(rowBottom.length > 0 ? rowBottom : images)];

  const closePreview = useCallback(() => setPreviewImage(null), []);

  if (images.length === 0) return null;

  return (
    <section id={section.id || 'reviews'} className="scroll-mt-20 pt-3 pb-8 md:pt-4 md:pb-10 lg:pt-5 lg:pb-12">
      <ScrollAnimation>
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-muted-foreground mb-6">
              {section.description}
            </p>
          )}
        </div>
      </ScrollAnimation>

      <div className="relative -ml-[50vw] -mr-[50vw] left-1/2 right-1/2 w-screen overflow-hidden py-4">
        {/* 上行 - 向左滚动 */}
        <div
          className="flex w-max gap-4 px-4 py-2 sm:px-8 lg:px-12"
          style={{
            animation: images.length > 1 ? 'review-marquee 34s linear infinite' : 'none',
          }}
        >
          {topLoop.map((item: { url?: string; src?: string; title?: string; alt?: string }, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() =>
                setPreviewImage({
                  src: item.url || item.src || '',
                  alt: item.title || item.alt || '客户好评截图',
                })
              }
              className="block cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-colors hover:border-blue-300"
            >
              <div className="aspect-[4/3] w-[240px] sm:w-[280px] lg:w-[320px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url || item.src || ''}
                  alt={item.title || item.alt || '客户好评截图'}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </button>
          ))}
        </div>

        {/* 下行 - 向左滚动（稍慢） */}
        <div
          className="flex w-max gap-4 px-4 py-2 sm:px-8 lg:px-12"
          style={{
            animation: images.length > 1 ? 'review-marquee 40s linear infinite' : 'none',
            animationDelay: '-12s',
          }}
        >
          {bottomLoop.map((item: { url?: string; src?: string; title?: string; alt?: string }, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() =>
                setPreviewImage({
                  src: item.url || item.src || '',
                  alt: item.title || item.alt || '客户好评截图',
                })
              }
              className="block cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-colors hover:border-blue-300"
            >
              <div className="aspect-[4/3] w-[240px] sm:w-[280px] lg:w-[320px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url || item.src || ''}
                  alt={item.title || item.alt || '客户好评截图'}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
        >
          <div className="absolute inset-0 bg-black/70" />
          <button
            type="button"
            className="fixed right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg hover:bg-white"
            onClick={closePreview}
            aria-label="关闭图片预览"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="relative z-20 mx-auto my-auto max-h-[72vh] w-auto max-w-[86vw] rounded-2xl bg-white object-contain shadow-2xl"
            src={previewImage.src}
            alt={previewImage.alt}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 轮播动画 CSS */}
      <style>{`
        @keyframes review-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
