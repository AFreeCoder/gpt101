'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

type ToolItem = {
  name: string;
  icon: string;
  href: string;
};

type TutorialItem = {
  title: string;
  icon: string;
  href: string;
  description: string;
};

export function ToolsAndTutorials({ section }: { section: Section }) {
  const tools: ToolItem[] = (section.tools as ToolItem[]) || [];
  const tutorials: TutorialItem[] = (section.tutorials as TutorialItem[]) || [];
  const tutorialsCenter = section.tutorials_center as { title?: string; url?: string } | undefined;

  return (
    <section id={section.id || 'tools-tutorials'} className="py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-800 md:text-4xl">
              {section.title}
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* 工具集合卡片 */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-800">
                {section.tools_title}
              </h3>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {tools.map((tool, idx) => (
                  <a
                    key={idx}
                    href={tool.href}
                    target={tool.href.startsWith('http') ? '_blank' : '_self'}
                    rel={tool.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="group rounded-lg border border-gray-100 bg-gray-50 p-3 text-center transition-all duration-300 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="mb-1 text-lg transition-transform duration-300 group-hover:scale-110">
                      {tool.icon}
                    </div>
                    <div className="text-xs font-medium text-gray-700 transition-colors group-hover:text-blue-600">
                      {tool.name}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* 教程文档卡片 */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-800">
                {section.tutorials_title}
              </h3>

              <div className="space-y-4">
                {tutorials.map((tutorial, idx) => (
                  <a
                    key={idx}
                    href={tutorial.href}
                    className="group block rounded-lg border border-gray-100 bg-gray-50 p-4 transition-all duration-300 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xl transition-transform duration-300 group-hover:scale-110">
                        {tutorial.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-1 text-sm font-bold text-gray-800 transition-colors group-hover:text-blue-600">
                          {tutorial.title}
                        </h4>
                        <p className="text-xs text-gray-600">{tutorial.description}</p>
                      </div>
                      <div className="text-gray-400 transition-colors group-hover:text-blue-500">
                        &rarr;
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {tutorialsCenter && (
                <div className="mt-6 text-center">
                  <a
                    href={tutorialsCenter.url || '/tutorials'}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    {tutorialsCenter.title}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollAnimation>
    </section>
  );
}
