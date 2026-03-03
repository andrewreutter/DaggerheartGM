import { Marked } from 'marked';
import { createElement } from 'react';

// Renderer override: open all links in new tab
const newTabRenderer = {
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
};

const markedInstance = new Marked({
  gfm: true,
  breaks: false,
  renderer: newTabRenderer,
});

export function renderMarkdown(text) {
  if (!text) return '';
  return markedInstance.parse(text);
}

export function MarkdownText({ text, className = '' }) {
  if (!text) return null;
  const html = renderMarkdown(text);
  return createElement('div', {
    className: `dh-md ${className}`,
    dangerouslySetInnerHTML: { __html: html },
  });
}
