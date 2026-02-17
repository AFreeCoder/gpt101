'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

type ComparisonItem = {
  feature: string;
  mirror: string;
  plus: string;
  highlight?: string;
};

export function ServiceComparison({ section }: { section: Section }) {
  const items: ComparisonItem[] = (section.items as ComparisonItem[]) || [];
  const columns = (section.columns || {}) as Record<string, string>;

  return (
    <section id={section.id || 'comparison'} className="bg-gray-50 py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-800 md:text-4xl">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="text-lg text-gray-600">{section.subtitle as string}</p>
            )}
          </div>

          {/* 对比表格 */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-1/3 px-6 py-4 text-left text-lg font-bold text-gray-800">
                      {columns.feature || '功能'}
                    </th>
                    <th className="w-1/3 px-6 py-4 text-center text-lg font-bold text-green-600">
                      {columns.mirror || '镜像服务'}
                    </th>
                    <th className="w-1/3 px-6 py-4 text-center text-lg font-bold text-blue-600">
                      {columns.plus || 'Plus会员'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => {
                    let rowClass = 'hover:bg-gray-50 transition-colors';
                    let featureClass = 'text-gray-800';
                    let mirrorBadge = '';
                    let plusBadge = '';
                    let icon = '';

                    if (item.highlight === 'network') {
                      rowClass = 'bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors';
                      featureClass = 'text-blue-800 font-semibold';
                      mirrorBadge = 'text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full';
                      plusBadge = 'text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full';
                      icon = '🌐';
                    } else if (item.highlight === 'limit') {
                      rowClass = 'bg-green-50 border-green-200 hover:bg-green-100 transition-colors';
                      featureClass = 'text-green-800 font-semibold';
                      mirrorBadge = 'text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full';
                      plusBadge = 'text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full';
                      icon = '⚡';
                    } else if (item.highlight === 'price') {
                      rowClass = 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 transition-colors border-2';
                      featureClass = 'text-yellow-800 font-bold';
                      mirrorBadge = 'text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full';
                      plusBadge = 'text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full';
                      icon = '💰';
                    }

                    return (
                      <tr key={idx} className={rowClass}>
                        <td className={`px-6 py-4 font-medium ${featureClass}`}>
                          {icon && <span className="mr-2">{icon}</span>}
                          {item.feature}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-medium ${mirrorBadge || 'text-gray-700'}`}>
                            {item.mirror}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-medium ${plusBadge || 'text-gray-700'}`}>
                            {item.plus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 底部提示 */}
          {section.tip && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-lg text-blue-600">💡</span>
                </div>
                <p className="font-medium text-blue-800">{section.tip as string}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollAnimation>
    </section>
  );
}
