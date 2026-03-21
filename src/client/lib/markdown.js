import { Marked } from 'marked';
import { createElement } from 'react';
import hljs from 'highlight.js';

// Renderer override: open all links in new tab
const newTabRenderer = {
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
  code({ text, lang }) {
    // This renderer is only called for code blocks (fenced code with ```)
    // Inline code uses a different token type and doesn't go through this renderer
    const language = (lang && lang.trim()) || 'plaintext';
    try {
      // Try to highlight with the specified language
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    } catch (e) {
      // Fallback if language not supported - highlight as plaintext
      try {
        const highlighted = hljs.highlight(text, { language: 'plaintext' }).value;
        return `<pre><code class="hljs">${highlighted}</code></pre>`;
      } catch (e2) {
        // Last resort - no highlighting
        return `<pre><code class="hljs">${text}</code></pre>`;
      }
    }
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
