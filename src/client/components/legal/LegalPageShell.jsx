import React from 'react';
import { shouldHandleSpaNavClick } from '../../lib/router.js';
import { MarkdownText } from '../../lib/markdown.js';
import { Footer } from '../Footer.jsx';

/**
 * Shared shell for static legal/support pages (Terms, Privacy, Support, Cookies).
 * Renders the Daggertop logo/wordmark + a "Back to Daggertop" link, a title,
 * a "Last updated" byline, the markdown body, and the site Footer.
 */
export function LegalPageShell({ title, markdown, navigate }) {
  const handleHomeClick = (e) => {
    if (shouldHandleSpaNavClick(e)) {
      e.preventDefault();
      navigate?.('/');
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-dh-canvas flex flex-col">
      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="flex flex-col items-center mb-8 gap-2">
            <a
              href="/"
              onClick={handleHomeClick}
              className="flex items-center gap-2 text-lg font-bold text-red-500 tracking-wider no-underline"
            >
              <img src="/assets/daggertop-logo.png" alt="Daggertop" className="w-8 h-8 object-contain" />
              DAGGERTOP
            </a>
            <a
              href="/"
              onClick={handleHomeClick}
              className="text-xs text-dh-muted hover:text-dh no-underline transition-colors"
            >
              &larr; Back to Daggertop
            </a>
          </div>

          <h1 className="text-3xl font-bold text-dh mb-1">{title}</h1>
          <p className="text-xs text-dh-muted mb-8">Last updated: August 2026</p>

          <MarkdownText text={markdown} className="text-dh-muted text-sm leading-relaxed" />
        </div>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
