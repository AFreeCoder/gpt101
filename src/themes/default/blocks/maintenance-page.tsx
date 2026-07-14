'use client';

import { ArrowLeft, ExternalLink, Shield } from 'lucide-react';
import Link from 'next/link';

import {
  CUSTOMER_SUPPORT_LABEL,
  CUSTOMER_SUPPORT_QR_CODE_URL,
  CUSTOMER_SUPPORT_URL,
} from '@/shared/lib/customer-support';

interface MaintenancePageProps {
  contactUrl?: string;
  qrCodeUrl?: string;
}

export function MaintenancePage({
  contactUrl = CUSTOMER_SUPPORT_URL,
  qrCodeUrl = CUSTOMER_SUPPORT_QR_CODE_URL,
}: MaintenancePageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 px-4 pt-24 pb-8 md:pt-36">
      <div className="w-full max-w-lg">
        {/* 返回按钮 */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>返回</span>
          </Link>
        </div>

        {/* 主要内容卡片 */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          {/* 维护状态头部 */}
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-purple-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
            </div>
            <h1 className="mb-3 text-xl font-bold text-gray-800">
              GPT Plus 正在维护升级
            </h1>
            <p className="text-sm leading-relaxed text-gray-600">
              系统升级中，升级期间如需充值 Plus或购买镜像请联系客服
            </p>
          </div>

          {/* 客服联系区域 */}
          <div className="px-6 pb-6">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-bold text-gray-800">联系客服</h2>
            </div>

            <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* 左侧二维码 */}
              <div className="flex-shrink-0 text-center">
                <div className="mb-2 w-32">
                  <a
                    href={contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={CUSTOMER_SUPPORT_LABEL}
                    className="block rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt="客服二维码"
                      className="h-auto w-full rounded-xl border border-gray-200 shadow-sm"
                    />
                  </a>
                </div>
                <p className="text-xs text-gray-600">客服二维码</p>
              </div>

              {/* 右侧客服链接 */}
              <div className="w-full flex-1">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 text-sm text-gray-700">需要人工协助？</p>
                  <a
                    href={contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors duration-300 hover:from-blue-700 hover:to-purple-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {CUSTOMER_SUPPORT_LABEL}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p>点击“联系客服”后，将打开企业微信客服页面。</p>
                    <p>也可以使用微信扫描左侧二维码。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 返回首页 */}
          <div className="px-6 pb-6">
            <Link
              href="/"
              className="block w-full rounded-lg bg-gray-100 py-3 text-center text-sm font-medium text-gray-700 transition-all duration-300 hover:bg-gray-200"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
