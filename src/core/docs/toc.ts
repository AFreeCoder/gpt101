import type { TOCItemType as FumadocsTOCItemType } from 'fumadocs-core/server';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

export type TOCItemType = FumadocsTOCItemType;

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

/**
 * Generate TOC (Table of Contents) from markdown/MDX content
 * Compatible with fumadocs TOCItemType format
 */
export function generateTOC(content: string): TOCItemType[] {
  if (!content) return [];

  const tokens = md.parse(content, {});
  const slugger = new GithubSlugger();
  const toc: TOCItemType[] = [];

  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;

    const inlineToken = tokens[index + 1];
    if (!inlineToken || inlineToken.type !== 'inline') return;

    const level = Number.parseInt(token.tag.slice(1), 10);
    const text = inlineToken.content.trim();
    if (!text || Number.isNaN(level)) return;

    const url = `#${slugger.slug(text)}`;
    toc.push({
      title: text,
      url,
      depth: level,
    });
  });

  return toc;
}
