'use client';

import { toast } from 'sonner';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

export function CustomerSupport({ section }: { section: Section }) {
  const cards = section.items || [];
  const qqNumber = section.qq_number || '2316149029';

  const handleCopy = () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(qqNumber).then(() => {
        toast.success('已复制到剪贴板');
      });
    } else {
      window.prompt('请复制客服QQ号', qqNumber);
    }
  };

  return (
    <section id={section.id || 'customer-support'} className="py-16 md:py-24">
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
                  <span className="text-3xl">{(card as Record<string, string>).icon}</span>
                </div>
                <h3 className="mb-3 text-lg font-bold text-gray-800">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {card.description}
                </p>
              </div>
            ))}

            {/* 客服联系方式卡片（如果 section 中配置了 qq_number） */}
            {section.show_contact_card && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg transition-shadow duration-300 hover:shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <span className="text-3xl">💬</span>
                </div>
                <h3 className="mb-3 text-lg font-bold text-gray-800">
                  客服联系方式
                </h3>
                <p className="mb-3 text-sm text-gray-600">QQ: {qqNumber}</p>
                <button
                  onClick={handleCopy}
                  className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-purple-700"
                >
                  <span>📋</span>
                  一键复制
                </button>
              </div>
            )}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
