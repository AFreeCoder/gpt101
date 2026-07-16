'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
    return (
      new URL(href, window.location.href).href ===
      new URL(CUSTOMER_SUPPORT_URL).href
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
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>('a[href]');

      if (
        !link ||
        link.hasAttribute('data-customer-support-bypass') ||
        !isCustomerSupportLink(link)
      ) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handleCustomerSupportClick);

    return () => {
      document.removeEventListener('click', handleCustomerSupportClick);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 text-white">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <MessageCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl text-white">
              {isZh ? '联系客服' : 'Contact support'}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {isZh
                ? '微信扫码添加客服，获取购买与售后帮助'
                : 'Scan with WeChat for purchase and after-sales support'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 pt-2 pb-6">
          <div className="flex justify-center">
            <a
              href={CUSTOMER_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-customer-support-bypass="true"
              aria-label={isZh ? '使用企业微信联系客服' : 'Open WeCom support'}
              className="rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CUSTOMER_SUPPORT_QR_CODE_URL}
                alt={isZh ? '客服二维码' : 'Customer support QR code'}
                width={220}
                height={220}
                decoding="async"
                className="h-auto w-55 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
              />
            </a>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            {isZh
              ? '长按或截图保存二维码，也可以直接打开企业微信。'
              : 'Save the QR code or open WeCom directly.'}
          </p>

          <a
            href={CUSTOMER_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-customer-support-bypass="true"
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isZh ? '打开企业微信' : 'Open WeCom'}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
