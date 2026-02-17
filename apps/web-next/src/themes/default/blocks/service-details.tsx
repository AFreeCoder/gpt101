'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

type StepItem = {
  number: string;
  title: string;
  description: string;
  tag: string;
  color: string;
};

type SecurityItem = {
  title: string;
  description: string;
  color: string;
};

const colorMap: Record<string, { bg: string; text: string; tagBg: string; tagText: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', tagBg: 'bg-blue-50', tagText: 'text-blue-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', tagBg: 'bg-purple-50', tagText: 'text-purple-700' },
  green: { bg: 'bg-green-100', text: 'text-green-600', tagBg: 'bg-green-50', tagText: 'text-green-700' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', tagBg: 'bg-orange-50', tagText: 'text-orange-700' },
};

export function ServiceDetails({ section }: { section: Section }) {
  const steps: StepItem[] = (section.steps as StepItem[]) || [];
  const security = section.security as { title?: string; items?: SecurityItem[] } | undefined;

  return (
    <section id={section.id || 'details'} className="py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-800 md:text-4xl">
              {section.title}
            </h2>
          </div>

          {/* 步骤卡片 */}
          <div className="mx-auto mb-12 grid max-w-5xl gap-8 md:grid-cols-3">
            {steps.map((step, idx) => {
              const colors = colorMap[step.color] || colorMap.blue;
              return (
                <div key={idx} className="text-center">
                  <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md transition-shadow duration-300 hover:shadow-lg">
                    <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${colors.bg}`}>
                      <span className={`text-2xl font-bold ${colors.text}`}>{step.number}</span>
                    </div>
                    <h3 className="mb-3 text-lg font-bold text-gray-800">{step.title}</h3>
                    <p className="mb-4 text-sm text-gray-600">{step.description}</p>
                    <div className={`rounded-lg p-3 ${colors.tagBg}`}>
                      <div className={`flex items-center justify-center gap-2 text-sm font-medium ${colors.tagText}`}>
                        <span>{step.tag}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 安全保障 */}
          {security && (
            <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-8">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-gray-800">{security.title}</h3>
              </div>
              <div className="grid gap-6 text-center md:grid-cols-4">
                {(security.items || []).map((item, idx) => {
                  const colors = colorMap[item.color] || colorMap.blue;
                  return (
                    <div key={idx}>
                      <div className={`mb-1 text-lg font-bold ${colors.text}`}>{item.title}</div>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollAnimation>
    </section>
  );
}
