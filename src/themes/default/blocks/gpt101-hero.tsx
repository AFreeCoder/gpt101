'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Info, Shield, Clock, CircleCheck } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { sendOutboundClick } from '@/shared/lib/gtag';
import { Section } from '@/shared/types/blocks/landing';

import { HeroSideAds } from './hero-side-ads';
import { PurchaseChannelModal } from './purchase-channel-modal';

export function Gpt101Hero({ section }: { section: Section }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const features = section.features || [];
  const trustMarks = section.trust_marks || [];
  const purchaseChannels = section.purchase_channels || [];

  const sideAds = section.side_ads as { left?: any; right?: any } | undefined;

  return (
    <section id={section.id} className="relative pt-[68px] pb-8 md:pt-[76px] md:pb-8">
      {sideAds && <HeroSideAds left={sideAds.left} right={sideAds.right} />}
      <div className="mx-auto max-w-4xl px-4 text-center">
        {/* 镜像服务推荐条 */}
        {section.mirror_banner && (
          <div className="mb-6">
            <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-2">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex flex-col items-center gap-2 sm:flex-row">
                    <span className="font-medium text-gray-700">
                      {section.mirror_banner.title}
                    </span>
                    <span className="font-medium text-gray-600">
                      {section.mirror_banner.subtitle}
                    </span>
                    <span className="font-semibold text-blue-600">
                      {section.mirror_banner.highlight}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link
                    href={section.mirror_banner.url || '/chatgpt-mirror'}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-blue-700 hover:shadow-md"
                  >
                    <span>{section.mirror_banner.button_text}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 主标题 */}
        <h1 className="mb-6 inline-block text-5xl font-bold md:text-6xl">
          <span className="text-blue-700 sm:bg-gradient-to-r sm:from-blue-600 sm:to-purple-600 sm:bg-clip-text sm:text-transparent">
            {section.highlight_text || '一站式 GPT'}
          </span>
          <span className="text-gray-800">
            {' '}{section.normal_text || '充值服务'}
          </span>
        </h1>

        {/* 副标题 */}
        <div className="mb-10">
          <p className="text-lg font-medium text-gray-700 md:text-xl">
            {section.description}
          </p>
        </div>

        {/* 分隔线 */}
        <div className="mx-auto mb-8 max-w-2xl">
          <div className="border-t border-dashed border-gray-300" />
        </div>

        {/* 核心卖点 */}
        {features.length > 0 && (
          <div className="mb-8">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 md:gap-3">
              {features.map((feature: { text: string }, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-100 px-3 py-1.5"
                >
                  <Check className="h-3.5 w-3.5 flex-shrink-0 text-green-600" strokeWidth={2.5} />
                  <span className="text-xs font-medium text-gray-700 md:text-sm">
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 分隔线 */}
        <div className="mx-auto mb-8 max-w-2xl">
          <div className="border-t border-dashed border-gray-300" />
        </div>

        {/* 两个主按钮 */}
        <div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {/* 卡密购买按钮 */}
          {section.buttons?.[0] && (
            <Link
              href={section.buttons[0].url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                const url = section.buttons![0].url || '';
                const label = section.buttons![0].title || '购买';
                sendOutboundClick(url, label);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-green-500 to-blue-500 px-10 py-4 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:from-green-600 hover:to-blue-600 hover:shadow-lg sm:w-auto"
            >
              {section.buttons[0].title}
            </Link>
          )}

          {/* 立即升级按钮 */}
          {section.buttons?.[1] && (
            <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-auto sm:flex-row">
              <div className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-[2px] shadow-md transition-all duration-300 hover:shadow-lg sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="group w-full rounded-[10px] bg-white px-10 py-4 text-lg font-bold transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600"
                >
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-colors group-hover:text-white">
                    {section.buttons[1].title}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 好评链接 + 客服快捷入口 */}
        {section.reviews_link && (
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="#reviews"
              className="inline-flex items-center gap-1.5 font-semibold text-amber-600 underline hover:text-amber-700"
            >
              查看客户好评 ★★★★★
            </Link>
            {section.customer_service_qq && (
              <>
                <span className="text-gray-400">|</span>
                <Link
                  href={`https://wpa.qq.com/msgrd?v=3&uin=${section.customer_service_qq}&site=qq&menu=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 underline hover:text-blue-700"
                >
                  客服 QQ：{section.customer_service_qq}
                </Link>
              </>
            )}
          </div>
        )}

        {/* 免责声明 */}
        {section.disclaimer && (
          <p className="mb-6 text-xs text-gray-500">
            {section.disclaimer.text}{' '}
            {section.disclaimer.link && (
              <Link
                href={section.disclaimer.link.url || '#'}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                {section.disclaimer.link.title}
              </Link>
            )}
          </p>
        )}

        {/* 信任标记 */}
        {trustMarks.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600">
            {trustMarks.map((mark: { text: string; icon: string }, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-gray-300">·</span>}
                {mark.icon === 'shield' && <Shield className="h-4 w-4 text-green-600" />}
                {mark.icon === 'clock' && <Clock className="h-4 w-4 text-green-600" />}
                {mark.icon === 'check' && <CircleCheck className="h-4 w-4 text-green-600" />}
                <span>{mark.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* 引导提示框 */}
        {section.guide_box && (
          <div className="mx-auto mb-4 max-w-2xl">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-6 py-4 text-center">
              <div className="mb-3 text-gray-700">
                <span className="inline-flex items-center justify-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span
                    className="font-medium"
                    dangerouslySetInnerHTML={{ __html: section.guide_box.text || '' }}
                  />
                </span>
              </div>
              {section.guide_box.links && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm md:gap-3">
                  {section.guide_box.links.map(
                    (link: { title: string; url: string; target?: string }, idx: number) => (
                      <span key={idx} className="flex items-center gap-2">
                        {idx > 0 && <span className="text-gray-400">|</span>}
                        <Link
                          href={link.url}
                          target={link.target || '_self'}
                          rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {link.title}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 购买渠道弹窗 */}
      <PurchaseChannelModal
        channels={purchaseChannels}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
