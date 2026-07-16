'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

import { CUSTOMER_SUPPORT_QR_CODE_URL } from '@/shared/lib/customer-support';
import { Section } from '@/shared/types/blocks/landing';

export function FloatingCustomerService({ section }: { section: Section }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const qrCodeUrl = section.qr_code_url || CUSTOMER_SUPPORT_QR_CODE_URL;

  const closePanel = useCallback(() => {
    triggerRef.current?.focus();
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [closePanel, isOpen]);

  return (
    <div
      ref={rootRef}
      className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6"
    >
      {/* 主按钮 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-colors duration-200 hover:from-blue-700 hover:to-purple-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="联系客服"
        aria-expanded={isOpen}
        aria-controls="floating-customer-support-panel"
      >
        <MessageSquare className="h-7 w-7" aria-hidden="true" />
      </button>

      {/* 客服卡片 */}
      {isOpen && (
        <div
          id="floating-customer-support-panel"
          className="animate-in fade-in-0 zoom-in-95 absolute right-0 bottom-20 w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-4 pt-12 text-slate-900 shadow-2xl duration-200 motion-reduce:animate-none"
          role="dialog"
          aria-label="客服二维码"
        >
          <button
            type="button"
            onClick={closePanel}
            className="absolute top-1.5 right-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="关闭客服二维码"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt="客服二维码"
            width={208}
            height={208}
            loading="lazy"
            decoding="async"
            className="mx-auto h-auto w-full max-w-52 rounded-xl bg-white"
          />
          <p className="mt-3 text-center text-sm font-medium text-slate-600">
            微信扫码联系客服
          </p>
        </div>
      )}
    </div>
  );
}
