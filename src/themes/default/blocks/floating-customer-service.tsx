'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, X, Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Section } from '@/shared/types/blocks/landing';

export function FloatingCustomerService({ section }: { section: Section }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const qqNumber = section.qq_number || '2316149029';
  const qrCodePath = section.qr_code_path || '/qq-qrcode.png';
  const serviceTime = section.service_time || '在线时间：9:00 ~ 23:00';

  const handleCopy = useCallback(() => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(qqNumber).then(() => {
        toast.success('已复制到剪贴板');
      });
    } else {
      window.prompt('请复制客服QQ号', qqNumber);
    }
  }, [qqNumber]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="fixed bottom-6 right-6 z-50">
      {/* 主按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
        aria-label="联系客服"
        aria-expanded={isOpen}
      >
        <MessageSquare className="h-7 w-7" />
        <span className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-red-500" />
      </button>

      {/* 客服卡片 */}
      <div
        className={`absolute bottom-20 right-0 w-64 overflow-hidden rounded-xl bg-white shadow-2xl transition-all duration-300 ${
          isOpen
            ? 'pointer-events-auto visible scale-100 opacity-100'
            : 'pointer-events-none invisible scale-95 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
      >
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">在线QQ客服</h3>
                <p className="text-xs text-white/80">有任何问题请联系客服</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/80 transition-colors hover:text-white"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="space-y-3 p-4">
          {/* QQ二维码 */}
          <div className="text-center">
            <p className="mb-2 text-xs font-medium text-gray-600">扫码添加客服QQ</p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodePath}
                alt="客服QQ二维码"
                width={128}
                height={128}
                loading="lazy"
                decoding="async"
                className="h-auto w-32 rounded-lg border border-gray-200"
              />
            </div>
          </div>

          {/* QQ号 + 复制 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                <p className="select-all text-sm font-bold text-gray-900">{qqNumber}</p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-white transition-colors duration-200 hover:bg-blue-700"
                aria-label="复制QQ号"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">复制</span>
              </button>
            </div>
          </div>

          {/* 服务时间 */}
          <div className="rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-2.5">
            <div className="flex items-center justify-center gap-1.5 text-blue-800">
              <Clock className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-semibold">{serviceTime}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
