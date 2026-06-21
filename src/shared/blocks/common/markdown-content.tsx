// Server-side Markdown renderer for database posts
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

interface MarkdownRenderEnv {
  headingSlugger?: GithubSlugger;
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

interface MarkdownContentProps {
  content: string;
}

/**
 * Server-side Markdown renderer for database posts
 * This component uses markdown-it which works in all environments including Edge Runtime
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  const env: MarkdownRenderEnv = { headingSlugger: new GithubSlugger() };
  const html = content ? md.render(content, env) : '';

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
