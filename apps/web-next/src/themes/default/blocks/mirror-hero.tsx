'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Info, ArrowRight } from 'lucide-react';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

export function MirrorHero({ section }: { section: Section }) {
  const [displayText, setDisplayText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const texts: string[] = section.typewriter_texts || [];

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (texts.length === 0) return;

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function tick() {
      const currentText = texts[textIndex];

      if (isDeleting) {
        charIndex = Math.max(charIndex - 1, 0);
        setDisplayText(currentText.substring(0, charIndex));
        if (charIndex === 0) {
          isDeleting = false;
          textIndex = (textIndex + 1) % texts.length;
          timerRef.current = setTimeout(tick, 500);
          return;
        }
      } else {
        setDisplayText(currentText.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentText.length) {
          timerRef.current = setTimeout(() => {
            isDeleting = true;
            tick();
          }, 2000);
          return;
        }
      }

      timerRef.current = setTimeout(tick, isDeleting ? 50 : 100);
    }

    tick();

    return cleanup;
  }, [texts, cleanup]);

  const buttons = section.buttons || [];
  const plusBanner = section.plus_banner as Record<string, string> | undefined;
  const disclaimer = section.disclaimer as { text?: string; link?: { title?: string; url?: string } } | undefined;

  return (
    <section id={section.id || 'hero'} className="pb-8 pt-6 md:pb-12 md:pt-8 lg:pb-16 lg:pt-10">
      <ScrollAnimation>
        <div className="mx-auto max-w-5xl px-4">
          {/* Plus 代充横幅 */}
          {plusBanner && (
            <div className="mb-6 w-full">
              <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-2">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <Info className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col items-center gap-2 sm:flex-row">
                      <span className="font-medium text-gray-700">{plusBanner.text}</span>
                      <span className="font-medium text-gray-600">{plusBanner.subtext}</span>
                      <span className="font-semibold text-blue-600">{plusBanner.highlight}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <a
                      href={plusBanner.url}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-blue-700 hover:shadow-md"
                    >
                      <span>{plusBanner.button_text}</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 大标题 */}
          <div className="mb-6 text-center">
            <h1 className="mb-6 text-7xl font-bold md:text-8xl">
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                {section.title_gradient}
              </span>
              <br />
              <span className="text-gray-800">{section.title_normal}</span>
            </h1>
          </div>

          {/* 打字机效果 */}
          {texts.length > 0 && (
            <div className="mb-8 text-center">
              <div className="flex min-h-[3rem] items-center justify-center text-2xl font-semibold text-green-600 md:text-3xl">
                {displayText}
                <span className="ml-0.5 animate-pulse">|</span>
              </div>
            </div>
          )}

          {/* 副标题 */}
          {section.subtitle && (
            <p className="mx-auto mb-8 max-w-3xl whitespace-pre-line text-center text-lg leading-relaxed text-gray-600">
              {section.subtitle as string}
            </p>
          )}

          {/* 按钮区 */}
          {buttons.length > 0 && (
            <div className="mb-4 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {buttons.map((btn, idx: number) => {
                const b = btn as Record<string, string>;
                const variant = b.variant || 'default';
                let className =
                  'rounded-xl px-8 py-3 font-semibold transition-all duration-300 shadow-md';
                if (variant === 'green') {
                  className +=
                    ' bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white';
                } else if (variant === 'purple') {
                  className +=
                    ' bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg';
                } else {
                  className +=
                    ' bg-gray-100 hover:bg-gray-200 text-gray-700';
                }

                const isExternal = b.target === '_blank' || (b.url && b.url.startsWith('http'));

                return (
                  <div key={idx} className={b.tooltip ? 'group relative' : ''}>
                    <a
                      href={b.url}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className={`block ${className}`}
                    >
                      {b.title}
                    </a>
                    {b.tooltip && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-sm text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {b.tooltip}
                        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 免责声明 */}
          {disclaimer && (
            <p className="mb-6 text-center text-xs text-gray-500">
              {disclaimer.text}
              {disclaimer.link && (
                <a
                  href={disclaimer.link.url}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {disclaimer.link.title}
                </a>
              )}
              。
            </p>
          )}

          {/* 服务保障 */}
          {section.guarantee && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-6 py-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <p className="font-semibold text-green-800">{section.guarantee as string}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollAnimation>
    </section>
  );
}
