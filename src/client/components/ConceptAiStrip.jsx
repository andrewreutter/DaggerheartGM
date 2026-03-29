import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { conceptAiEnabled } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from '../lib/ai-ui-visibility.js';
import { handleAiConceptTextareaKeyDown } from '../lib/ai-concept-textarea.js';
import { MarkdownText } from '../lib/markdown.js';
import { AiDismissBuildWithAiLink } from './AiDismissBuildWithAiLink.jsx';
import { shouldAttemptConceptAiAutoSubmit } from '../lib/concept-ai-auto-submit.js';

/**
 * Generic “describe a concept → Build with AI” strip (character, adversary, environment).
 *
 * @param {(concept: string, opts: { signal?: AbortSignal }) => Promise<{ patch: object, justification?: string, warnings?: string[] }>} postBuild
 * @param {() => object} getMergeBase
 * @param {(merged: object) => object} [transformMerged] — e.g. recomputeCharacter for PCs
 * @param {(result: object) => void | Promise<void>} onComplete
 * @param {boolean} [gateReady=true] — when false, render nothing (e.g. SRD still loading)
 * @param {boolean} [prerequisitesReady=true] — when false, Build is disabled (e.g. set tier/role first)
 * @param {string} [prerequisitesHint] — shown when prerequisitesReady is false
 * @param {string} [initialConcept] — seed the textarea (e.g. pending “Build with AI” from Encounter / Add dialog)
 * @param {string} [initialConceptKey] — when this changes, re-apply initialConcept if non-empty (e.g. editor item id + session)
 * @param {string} [autoSubmitKey] — when set, run one Build after the textarea is seeded and prerequisites pass (panel → editor flow). Include the pending concept in the key (e.g. `${session}:${concept}`) so a second pending concept for the same draft id auto-builds again.
 * @param {() => void} [onPendingConsumed] — after a successful build or a non-abort failure; clears parent “pending concept” state
 */
export const ConceptAiStrip = forwardRef(function ConceptAiStrip(
  {
    postBuild,
    getMergeBase,
    transformMerged,
    onComplete,
    onAiBusyChange,
    onPendingConsumed,
    variant = 'default',
    compactJustification = false,
    showOrSeparators = false,
    textareaRows,
    gateReady = true,
    prerequisitesReady = true,
    prerequisitesHint = '',
    labels = {},
    /** When false, the parent shows loading (e.g. form overlay); avoids duplicate spinners. */
    showBuildButtonSpinner = true,
    initialConcept,
    initialConceptKey,
    autoSubmitKey,
  },
  ref,
) {
  const { hideAiUi } = useAiUiPreference();
  const {
    title = 'Describe a concept, we’ll match it as best as we can',
    placeholder = '',
    buildButton = 'Build with AI',
    summaryTitle = 'AI picks summary',
  } = labels;

  const [aiConcept, setAiConcept] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiJustification, setAiJustification] = useState('');
  const [aiJustificationOpen, setAiJustificationOpen] = useState(true);
  const [aiError, setAiError] = useState('');
  const [aiResolverNotes, setAiResolverNotes] = useState('');
  const abortControllerRef = useRef(null);
  const getMergeBaseRef = useRef(getMergeBase);
  const transformMergedRef = useRef(transformMerged);
  /** Keyed path: last applied `${initialConceptKey}\\0${trimmed}` so a new pending concept re-seeds even when the editor id is unchanged. */
  const lastKeyedSeedSigRef = useRef(null);
  const unkeyedInitialSeededRef = useRef(false);
  const autoSubmitFiredForKeyRef = useRef(null);
  const handleAiBuildRef = useRef(async () => {});
  getMergeBaseRef.current = getMergeBase;
  transformMergedRef.current = transformMerged;

  useEffect(() => {
    const trimmed = (initialConcept ?? '').trim();
    if (!trimmed) return;
    if (initialConceptKey !== undefined && initialConceptKey !== null) {
      const key = String(initialConceptKey);
      const sig = `${key}\0${trimmed}`;
      if (lastKeyedSeedSigRef.current === sig) return;
      lastKeyedSeedSigRef.current = sig;
      setAiConcept(initialConcept);
      return;
    }
    if (unkeyedInitialSeededRef.current) return;
    unkeyedInitialSeededRef.current = true;
    setAiConcept(initialConcept);
  }, [initialConcept, initialConceptKey]);

  useEffect(() => {
    autoSubmitFiredForKeyRef.current = null;
  }, [autoSubmitKey]);

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
    if (!q || aiLoading || !gateReady || !prerequisitesReady) return;
    setAiError('');
    setAiResolverNotes('');
    setAiJustification('');
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setAiLoading(true);
    try {
      const { patch, justification, warnings } = await postBuild(q, { signal: ac.signal });
      let merged = { ...getMergeBaseRef.current(), ...patch };
      if (transformMergedRef.current) {
        merged = transformMergedRef.current(merged);
      }
      const j = (justification || '').trim();
      setAiJustification(j);
      setAiJustificationOpen(!compactJustification);
      setAiResolverNotes(warnings?.length ? warnings.map((w) => `• ${w}`).join('\n') : '');
      await onComplete(merged);
      onPendingConsumed?.();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setAiError(e?.message || 'Request failed');
      setAiResolverNotes('');
      onPendingConsumed?.();
    } finally {
      if (abortControllerRef.current === ac) abortControllerRef.current = null;
      setAiLoading(false);
    }
  }, [aiConcept, aiLoading, gateReady, prerequisitesReady, compactJustification, onComplete, onPendingConsumed, postBuild]);

  handleAiBuildRef.current = handleAiBuild;

  useEffect(() => {
    const q = aiConcept.trim();
    if (
      !shouldAttemptConceptAiAutoSubmit({
        autoSubmitKey,
        aiConceptTrimmed: q,
        gateReady,
        prerequisitesReady,
        aiLoading,
        alreadyFiredForKey: autoSubmitFiredForKeyRef.current,
      })
    ) {
      return;
    }
    autoSubmitFiredForKeyRef.current = autoSubmitKey;
    void handleAiBuildRef.current();
  }, [autoSubmitKey, aiConcept, gateReady, prerequisitesReady, aiLoading]);

  if (!shouldShowConceptAiUi(conceptAiEnabled, hideAiUi) || !gateReady) return null;

  const compact = variant === 'compact';
  const taRows = textareaRows ?? (compact ? 2 : 3);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {showOrSeparators ? (
        <div className="text-center text-xs font-semibold tracking-widest text-dh-muted py-0.5">OR</div>
      ) : null}
      <div
        className={`rounded-lg border border-violet-800/45 bg-violet-950/20 ${compact ? 'p-2' : 'p-3'} space-y-2`}
      >
        <label className="text-xs font-medium text-dh block">{title}</label>
        {!prerequisitesReady && prerequisitesHint ? (
          <p className="text-xs text-amber-200/90">{prerequisitesHint}</p>
        ) : null}
        <textarea
          value={aiConcept}
          onChange={(e) => setAiConcept(e.target.value)}
          onKeyDown={(e) =>
            handleAiConceptTextareaKeyDown(e, {
              canSubmit: !aiLoading && !!aiConcept.trim() && gateReady && prerequisitesReady,
              onSubmit: () => void handleAiBuild(),
            })
          }
          disabled={aiLoading}
          rows={taRows}
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y disabled:opacity-50"
          placeholder={placeholder}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAiBuild()}
            disabled={aiLoading || !aiConcept.trim() || !prerequisitesReady}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {showBuildButtonSpinner && aiLoading ? (
              <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
            ) : null}
            {buildButton}
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
        <AiDismissBuildWithAiLink />
      </div>

      {showOrSeparators ? (
        <div className="text-center text-xs font-semibold tracking-widest text-dh-muted py-0.5">OR</div>
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
            {summaryTitle}
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

ConceptAiStrip.displayName = 'ConceptAiStrip';
