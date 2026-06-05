'use client';

import { useState } from 'react';

import { Link } from '@/core/i18n/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

export function Faq({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const items = section.items || [];
  const allCategoryLabel = section.category_all_label || '全部';
  const [activeCategory, setActiveCategory] = useState(allCategoryLabel);
  const categories = [
    allCategoryLabel,
    ...Array.from(
      new Set([
        ...(section.categories || []),
        ...items.map((item) => item.category).filter(Boolean),
      ])
    ),
  ];
  const filteredItems =
    activeCategory === allCategoryLabel
      ? items
      : items.filter((item) => item.category === activeCategory);

  return (
    <section id={section.id} className={`py-16 md:py-24 ${className || ''}`}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[0.8fr_1.2fr] md:px-8">
        <ScrollAnimation>
          <div className="md:sticky md:top-24">
            <div className="border-primary/20 text-primary mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
              FAQ
            </div>
            <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground max-w-md text-base leading-7">
              {section.description}
            </p>
            {section.tip && (
              <p className="text-muted-foreground mt-6 rounded-lg border border-dashed px-4 py-3 text-sm leading-6">
                {section.tip}
              </p>
            )}
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="min-w-0">
            {categories.length > 2 && (
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      activeCategory === category
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
            <Accordion
              key={activeCategory}
              type="single"
              collapsible
              defaultValue={
                filteredItems[0]?.question || filteredItems[0]?.title || ''
              }
              className="w-full space-y-3"
            >
              {filteredItems.map((item, idx) => (
                <AccordionItem
                  value={item.question || item.title || String(idx)}
                  className="border-border bg-background data-[state=open]:bg-muted/40 rounded-lg border px-5 shadow-sm transition-colors"
                  key={item.question || item.title || idx}
                >
                  <AccordionTrigger className="cursor-pointer gap-4 py-4 text-left text-base font-medium hover:no-underline">
                    <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      {item.category && (
                        <span className="border-primary/20 bg-primary/5 text-primary w-fit shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium">
                          {item.category}
                        </span>
                      )}
                      <span className="min-w-0">
                        {item.question || item.title || ''}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground pb-4 text-base leading-7">
                      {item.answer || item.description || ''}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {section.buttons && section.buttons.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {section.buttons.map((button, index) => (
                  <Link
                    key={index}
                    href={button.url || ''}
                    target={button.target || '_self'}
                    className="border-border bg-background hover:bg-muted inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
                  >
                    {button.title || button.text || ''}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
