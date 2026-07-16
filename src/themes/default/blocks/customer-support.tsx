'use client';

import { MessageCircle } from 'lucide-react';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  CUSTOMER_SUPPORT_LABEL,
  CUSTOMER_SUPPORT_URL,
} from '@/shared/lib/customer-support';
import { Section } from '@/shared/types/blocks/landing';

export function CustomerSupport({ section }: { section: Section }) {
  const cards = section.items || [];
  const contactUrl = section.contact_url || CUSTOMER_SUPPORT_URL;

  return (
    <section
      id={section.id || 'customer-support'}
      className="scroll-mt-20 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4">
        <ScrollAnimation>
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-800 md:text-4xl">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-lg text-gray-600">{section.description}</p>
            )}
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg transition-shadow duration-300 hover:shadow-xl"
              >
                <div
                  className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                    (card as Record<string, string>).color === 'green'
                      ? 'bg-green-100'
                      : (card as Record<string, string>).color === 'blue'
                        ? 'bg-blue-100'
                        : (card as Record<string, string>).color === 'orange'
                          ? 'bg-orange-100'
                          : 'bg-purple-100'
                  }`}
                >
                  <span className="text-3xl">
                    {(card as Record<string, string>).icon}
                  </span>
                </div>
                <h3 className="mb-3 text-lg font-bold text-gray-800">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {card.description}
                </p>
              </div>
            ))}

            {/* 客服联系方式卡片 */}
            {section.show_contact_card && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg transition-shadow duration-300 hover:shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <MessageCircle
                    className="h-8 w-8 text-purple-700"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mb-3 text-lg font-bold text-gray-800">
                  客服联系方式
                </h3>
                <p className="mb-3 text-sm text-gray-600">需要人工协助？</p>
                <a
                  href={contactUrl}
                  className="mx-auto inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-purple-700 focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {CUSTOMER_SUPPORT_LABEL}
                </a>
              </div>
            )}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
