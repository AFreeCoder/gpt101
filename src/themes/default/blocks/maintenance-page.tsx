'use client';

import { useCallback } from 'react';
import { ArrowLeft, Copy, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface MaintenancePageProps {
  qqNumber?: string;
  qrCodePath?: string;
}

export function MaintenancePage({
  qqNumber = '2316149029',
  qrCodePath = '/qq-qrcode.png',
}: MaintenancePageProps) {
  const handleCopy = useCallback(() => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(qqNumber).then(() => {
        toast.success('QQ号已复制到剪贴板');
      });
    } else {
      window.prompt('请复制客服QQ号', qqNumber);
    }
  }, [qqNumber]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* 返回按钮 */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>返回</span>
          </a>
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
              <h2 className="text-lg font-bold text-gray-800">添加客服QQ</h2>
            </div>

            <div className="mb-6 flex items-start gap-6">
              {/* 左侧二维码 */}
              <div className="flex-shrink-0 text-center">
                <div className="mb-2 h-32 w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodePath}
                    alt="客服QQ二维码"
                    className="h-full w-full rounded-xl border border-gray-200 object-cover shadow-sm"
                  />
                </div>
                <p className="text-xs text-gray-600">客服QQ二维码</p>
              </div>

              {/* 右侧QQ号 */}
              <div className="flex-1">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">
                      QQ：<span className="font-mono font-semibold">{qqNumber}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-sm text-white transition-all duration-300 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Copy className="h-3 w-3" />
                      复制
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-yellow-700">
                      <span>添加时请备注：<span className="font-bold">gpt</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span>添加客服后即可正常充值</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 返回首页 */}
          <div className="px-6 pb-6">
            <a
              href="/"
              className="block w-full rounded-lg bg-gray-100 py-3 text-center text-sm font-medium text-gray-700 transition-all duration-300 hover:bg-gray-200"
            >
              返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
