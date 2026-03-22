import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { MarkdownText } from '../lib/markdown.js';
import { parseGuideMarkdown } from '../lib/feature-authoring-guide-parse.js';
import { fetchFeatureAuthoringGuide } from '../lib/api.js';

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
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const scrollToId = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!open) return null;

  const parsed = markdown ? parseGuideMarkdown(markdown) : null;

  const shell = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-authoring-guide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-[min(90vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <BookOpen size={20} className="text-sky-400" />
            <h2 id="feature-authoring-guide-title" className="text-lg font-semibold">
              Feature authoring guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="w-56 shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-950/80 py-3 text-sm">
            {loading && (
              <div className="flex items-center gap-2 px-3 text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            )}
            {error && (
              <p className="px-3 text-red-400">{error}</p>
            )}
            {parsed && !loading && !error && (
              <ul className="space-y-0.5">
                {parsed.preamble.trim() && (
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToId('guide-intro')}
                      className="w-full px-3 py-1.5 text-left text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Introduction
                    </button>
                  </li>
                )}
                {parsed.sections.map((sec) => (
                  <li key={sec.id}>
                    <button
                      type="button"
                      onClick={() => scrollToId(sec.id)}
                      className="w-full px-3 py-1.5 text-left font-medium text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      {sec.title}
                    </button>
                    {sec.subs.length > 0 && (
                      <ul className="ml-2 border-l border-slate-700 pl-2">
                        {sec.subs.map((sub) => (
                          <li key={sub.id}>
                            <button
                              type="button"
                              onClick={() => scrollToId(sub.id)}
                              className="w-full py-1 text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            >
                              {sub.title}
                            </button>
                            {sub.subSubs && sub.subSubs.length > 0 && (
                              <ul className="ml-2 border-l border-slate-700/50 pl-2">
                                {sub.subSubs.map((subSub) => (
                                  <li key={subSub.id}>
                                    <button
                                      type="button"
                                      onClick={() => scrollToId(subSub.id)}
                                      className="w-full py-0.5 text-left text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-300"
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
              <div className="dh-md max-w-none text-slate-200 [&_pre]:text-xs flex flex-col gap-14 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_li]:mb-1">
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
                      secIdx > 0 ? 'border-t border-slate-800 pt-12' : ''
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
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
