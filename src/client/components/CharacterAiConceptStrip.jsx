import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { characterAiEnabled, postCharacterAiBuild } from '../lib/api.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { recomputeCharacter } from '../lib/character-calc.js';
import { MarkdownText } from '../lib/markdown.js';

/**
 * Shared “describe a concept → Build with AI” UI. Caller supplies how to merge the API patch
 * (`getMergeBase`) and what to do with the recomputed character (`onComplete`).
 * Ref exposes `{ cancel() }` for e.g. a blocking overlay Cancel button (CharacterForm).
 */
export const CharacterAiConceptStrip = forwardRef(function CharacterAiConceptStrip(
  {
    getMergeBase,
    onComplete,
    onAiBusyChange,
    variant = 'default',
    /** When true, omit expandable justification block (still shows warnings / errors). */
    compactJustification = false,
    /** When true, show centered “OR” above and below the main AI concept card (e.g. Add Character picker). */
    showOrSeparators = false,
    /** Override textarea height (`rows`). Default: 3 for default variant, 2 for compact. */
    textareaRows,
  },
  ref,
) {
  const { srdData, loading: srdLoading } = useCharacterSrdData();
  const [aiConcept, setAiConcept] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiJustification, setAiJustification] = useState('');
  const [aiJustificationOpen, setAiJustificationOpen] = useState(true);
  const [aiError, setAiError] = useState('');
  const [aiResolverNotes, setAiResolverNotes] = useState('');
  const abortControllerRef = useRef(null);
  const getMergeBaseRef = useRef(getMergeBase);
  getMergeBaseRef.current = getMergeBase;

  useEffect(() => {
    onAiBusyChange?.(aiLoading);
  }, [aiLoading, onAiBusyChange]);

  const handleAiCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAiLoading(false);
    setAiError('');
    setAiResolverNotes('');
  }, []);

  useImperativeHandle(ref, () => ({ cancel: handleAiCancel }), [handleAiCancel]);

  const handleAiBuild = useCallback(async () => {
    const q = aiConcept.trim();
    if (!q || aiLoading || !srdData) return;
    setAiError('');
    setAiResolverNotes('');
    setAiJustification('');
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setAiLoading(true);
    try {
      const { patch, justification, warnings } = await postCharacterAiBuild(q, { signal: ac.signal });
      const merged = { ...getMergeBaseRef.current(), ...patch };
      const recomputed = recomputeCharacter(merged, srdData);
      const j = (justification || '').trim();
      setAiJustification(j);
      setAiJustificationOpen(!compactJustification);
      setAiResolverNotes(warnings?.length ? warnings.map((w) => `• ${w}`).join('\n') : '');
      await onComplete(recomputed);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setAiError(e?.message || 'Request failed');
      setAiResolverNotes('');
    } finally {
      if (abortControllerRef.current === ac) abortControllerRef.current = null;
      setAiLoading(false);
    }
  }, [aiConcept, aiLoading, srdData, compactJustification, onComplete]);

  if (!characterAiEnabled || srdLoading) return null;

  const compact = variant === 'compact';
  const taRows = textareaRows ?? (compact ? 2 : 3);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {showOrSeparators ? (
        <div className="text-center text-xs font-semibold tracking-widest text-dh-muted py-0.5">
          OR
        </div>
      ) : null}
      <div
        className={`rounded-lg border border-violet-800/45 bg-violet-950/20 ${compact ? 'p-2' : 'p-3'} space-y-2`}
      >
        <label className="text-xs font-medium text-dh block">
          Describe a character concept, we&apos;ll match it as best as we can
        </label>
        <textarea
          value={aiConcept}
          onChange={(e) => setAiConcept(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            e.preventDefault();
            if (!aiLoading && aiConcept.trim()) void handleAiBuild();
          }}
          disabled={aiLoading}
          rows={taRows}
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y disabled:opacity-50"
          placeholder="e.g. A cheerful halfling thief who grew up in a library and wants to map the world…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAiBuild()}
            disabled={aiLoading || !aiConcept.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin shrink-0" aria-hidden /> : null}
            Build with AI
          </button>
          <button
            type="button"
            onClick={handleAiCancel}
            disabled={!aiLoading}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-dh-border text-dh-muted hover:bg-dh-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {showOrSeparators ? (
        <div className="text-center text-xs font-semibold tracking-widest text-dh-muted py-0.5">
          OR
        </div>
      ) : null}

      {aiJustification && !compactJustification ? (
        <div className="rounded-md border border-dh-border bg-dh-raised/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setAiJustificationOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs font-semibold text-dh hover:bg-dh-hover/30 transition-colors"
          >
            {aiJustificationOpen ? (
              <ChevronDown size={14} className="text-dh-muted shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-dh-muted shrink-0" />
            )}
            AI picks summary
          </button>
          {aiJustificationOpen ? (
            <div className="px-2 pb-2 border-t border-dh-border/80 pt-2 text-sm text-dh-muted">
              <MarkdownText text={aiJustification} className="dh-md" />
            </div>
          ) : null}
        </div>
      ) : null}

      {aiResolverNotes ? (
        <div className="text-xs text-amber-200/90 whitespace-pre-wrap rounded-md border border-amber-900/40 bg-amber-950/25 px-2 py-1.5">
          {aiResolverNotes}
        </div>
      ) : null}

      {aiError ? (
        <div className="text-xs text-red-300 whitespace-pre-wrap rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1.5">
          {aiError}
        </div>
      ) : null}
    </div>
  );
});

CharacterAiConceptStrip.displayName = 'CharacterAiConceptStrip';
