'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  CUSTOMER_SUPPORT_QR_CODE_URL,
  CUSTOMER_SUPPORT_URL,
} from '@/shared/lib/customer-support';

function isCustomerSupportLink(link: HTMLAnchorElement) {
  const href = link.getAttribute('href');

  if (!href) {
    return false;
  }

  try {
    const linkUrl = new URL(href, window.location.href);

    return (
      linkUrl.hash === CUSTOMER_SUPPORT_URL ||
      (linkUrl.hostname === 'work.weixin.qq.com' &&
        linkUrl.pathname.startsWith('/ca/'))
    );
  } catch {
    return false;
  }
}

export function CustomerSupportDialog({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const isZh = locale === 'zh';

  useEffect(() => {
    const handleCustomerSupportClick = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.button !== 0 && event.button !== 1)) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>('a[href]');

      if (!link || !isCustomerSupportLink(link)) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handleCustomerSupportClick, true);
    document.addEventListener('auxclick', handleCustomerSupportClick, true);

    return () => {
      document.removeEventListener('click', handleCustomerSupportClick, true);
      document.removeEventListener('auxclick', handleCustomerSupportClick, true);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1.5rem)] max-w-[17.5rem] gap-0 rounded-2xl border border-slate-200 bg-white p-4 pt-12 text-slate-900 shadow-2xl sm:max-w-[17.5rem] sm:p-5 sm:pt-12"
      >
        <DialogTitle className="sr-only">
          {isZh ? '客服二维码' : 'Customer support QR code'}
        </DialogTitle>

        <DialogClose asChild>
          <button
            type="button"
            aria-label={isZh ? '关闭客服二维码' : 'Close support QR code'}
            className="absolute top-1.5 right-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </DialogClose>

        <div className="mx-auto w-full max-w-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CUSTOMER_SUPPORT_QR_CODE_URL}
            alt={isZh ? '客服二维码' : 'Customer support QR code'}
            width={224}
            height={224}
            decoding="async"
            className="h-auto w-full rounded-xl bg-white"
          />
        </div>

        <DialogDescription className="mt-3 text-center text-sm font-medium text-slate-600">
          {isZh ? '微信扫码联系客服' : 'Scan with WeChat to contact support'}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
