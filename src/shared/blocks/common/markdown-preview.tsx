// components/MarkdownPreview.tsx
'use client';

import { useMemo } from 'react';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

import 'github-markdown-css/github-markdown-light.css';
import './markdown.css';

interface MarkdownRenderEnv {
  headingSlugger?: GithubSlugger;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function getTocItems(content: string): TocItem[] {
  if (!content) return [];

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;
  const slugger = new GithubSlugger();

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugger.slug(text);

    toc.push({ id, text, level });
  }

  return toc;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

// Custom renderer for headings with IDs
md.renderer.rules.heading_open = function (tokens, idx, _options, env) {
  const token = tokens[idx];
  const level = token.tag.slice(1);
  const nextToken = tokens[idx + 1];

  if (nextToken && nextToken.type === 'inline') {
    const headingText = nextToken.content.trim();
    const slugger = (env as MarkdownRenderEnv).headingSlugger;
    const id = slugger?.slug(headingText) || '';

    return `<h${level} id="${md.utils.escapeHtml(id)}">`;
  }

  return `<h${level}>`;
};

// Custom renderer for links with nofollow
md.renderer.rules.link_open = function (tokens, idx, options, env, renderer) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');

  if (hrefIndex >= 0) {
    const href = token.attrGet('href');
    // Add nofollow to all links
    token.attrSet('rel', 'nofollow');
    // Optionally add target="_blank" for external links
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      token.attrSet('target', '_blank');
    }
  }

  return renderer.renderToken(tokens, idx, options);
};

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const env: MarkdownRenderEnv = { headingSlugger: new GithubSlugger() };

    return content ? md.render(content, env) : '';
  }, [content]);

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
