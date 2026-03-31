import { useEffect, useState, useCallback } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { MarkdownText } from '../lib/markdown.js';
import { parseGuideMarkdown } from '../lib/feature-authoring-guide-parse.js';
import { fetchFeatureAuthoringGuide } from '../lib/api.js';
import { FullPageOverlay, FullPageOverlayHeader } from './FullPageOverlay.jsx';

export function FeatureAuthoringGuideModal({ open, onClose }) {
  const [markdown, setMarkdown] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFeatureAuthoringGuide()
      .then(({ markdown: md }) => {
        if (!cancelled) {
          setMarkdown(md);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const scrollToId = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!open) return null;

  const parsed = markdown ? parseGuideMarkdown(markdown) : null;

  return (
    <FullPageOverlay open={open} onClose={onClose} ariaLabelledBy="feature-authoring-guide-title">
      <FullPageOverlayHeader
        title="Feature authoring guide"
        titleId="feature-authoring-guide-title"
        icon={BookOpen}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1">
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-dh-border bg-dh-inset/80 py-3 text-sm">
          {loading && (
            <div className="flex items-center gap-2 px-3 text-dh-muted">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          )}
          {error && <p className="px-3 text-red-400">{error}</p>}
          {parsed && !loading && !error && (
            <ul className="space-y-0.5">
              {parsed.preamble.trim() && (
                <li>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => scrollToId('guide-intro')}
                    className="w-full px-3 py-1.5 text-left text-dh hover:bg-dh-hover hover:text-dh"
                  >
                    Introduction
                  </button>
                </li>
              )}
              {parsed.sections.map((sec) => (
                <li key={sec.id}>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => scrollToId(sec.id)}
                    className="w-full px-3 py-1.5 text-left font-medium text-dh hover:bg-dh-hover hover:text-dh"
                  >
                    {sec.title}
                  </button>
                  {sec.subs.length > 0 && (
                    <ul className="ml-2 border-l border-dh-border pl-2">
                      {sec.subs.map((sub) => (
                        <li key={sub.id}>
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={() => scrollToId(sub.id)}
                            className="w-full py-1 text-left text-xs text-dh-muted hover:bg-dh-hover hover:text-dh"
                          >
                            {sub.title}
                          </button>
                          {sub.subSubs && sub.subSubs.length > 0 && (
                            <ul className="ml-2 border-l border-dh-border/50 pl-2">
                              {sub.subSubs.map((subSub) => (
                                <li key={subSub.id}>
                                  <button
                                    type="button"
                                    tabIndex={0}
                                    onClick={() => scrollToId(subSub.id)}
                                    className="w-full py-0.5 text-left text-[10px] text-dh-muted hover:bg-dh-hover hover:text-dh"
                                  >
                                    {subSub.title}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6">
          {parsed && !loading && !error && (
            <div className="dh-md max-w-none text-dh [&_pre]:text-xs flex flex-col gap-14 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_li]:mb-1">
              {parsed.preamble.trim() && (
                <div id="guide-intro" className="scroll-mt-4">
                  <MarkdownText text={parsed.preamble} />
                </div>
              )}
              {parsed.sections.map((sec, secIdx) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className={`scroll-mt-6 [&_h2]:mb-4 ${
                    secIdx > 0 ? 'border-t border-dh-border pt-12' : ''
                  }`}
                >
                  <MarkdownText text={`## ${sec.title}`} />
                  {sec.subs.length === 0 ? (
                    <MarkdownText text={sec.intro} />
                  ) : (
                    <div className="mt-6 space-y-12">
                      {sec.intro.trim() && <MarkdownText text={sec.intro} />}
                      {sec.subs.map((sub) => (
                        <div key={sub.id} id={sub.id} className="scroll-mt-8 [&_h3]:mb-3">
                          {sub.subSubs && sub.subSubs.length > 0 ? (
                            <div className="space-y-10">
                              <MarkdownText text={`### ${sub.title}`} />
                              {sub.intro.trim() && <MarkdownText text={sub.intro} />}
                              {sub.subSubs.map((subSub) => (
                                <div key={subSub.id} id={subSub.id} className="scroll-mt-6 [&_h4]:mb-3">
                                  <MarkdownText text={`#### ${subSub.title}\n${subSub.markdown}`} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <MarkdownText text={`### ${sub.title}\n${sub.intro || ''}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </FullPageOverlay>
  );
}
