import { Marked } from 'marked';
import { createElement } from 'react';

// Custom extension: Reddit superscript  ^word  or  ^(multi word)
const superscriptExtension = {
  name: 'superscript',
  level: 'inline',
  start(src) {
    return src.indexOf('^');
  },
  tokenizer(src) {
    // ^(multi word) form
    const multiMatch = src.match(/^\^\(([^)]+)\)/);
    if (multiMatch) {
      return { type: 'superscript', raw: multiMatch[0], text: multiMatch[1] };
    }
    // ^word form (no spaces, stops at whitespace/punctuation)
    const singleMatch = src.match(/^\^(\S+)/);
    if (singleMatch) {
      return { type: 'superscript', raw: singleMatch[0], text: singleMatch[1] };
    }
  },
  renderer(token) {
    return `<sup>${token.text}</sup>`;
  },
};

// Custom extension: r/subreddit and u/username auto-linking
const redditMentionExtension = {
  name: 'redditMention',
  level: 'inline',
  start(src) {
    const idx = src.search(/\b[ru]\//);
    return idx === -1 ? Infinity : idx;
  },
  tokenizer(src) {
    const match = src.match(/^([ru])\/(\w+)/);
    if (match) {
      return { type: 'redditMention', raw: match[0], kind: match[1], name: match[2] };
    }
  },
  renderer(token) {
    const base = token.kind === 'r' ? 'https://reddit.com/r/' : 'https://reddit.com/u/';
    const label = `${token.kind}/${token.name}`;
    return `<a href="${base}${token.name}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  },
};

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
  breaks: true,
  extensions: [superscriptExtension, redditMentionExtension],
  renderer: newTabRenderer,
});

export function renderRedditMarkdown(text) {
  if (!text) return '';
  return markedInstance.parse(text);
}

export function RedditMarkdown({ text, className = '' }) {
  if (!text) return null;
  const html = renderRedditMarkdown(text);
  return createElement('div', {
    className: `reddit-md ${className}`,
    dangerouslySetInnerHTML: { __html: html },
  });
}
