import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Bot, ExternalLink, Loader2, Search, Send, Sparkles } from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { FullPageOverlay, FullPageOverlayHeader } from './FullPageOverlay.jsx';
import { postLibraryAiAnswer } from '../lib/api.js';
import { MarkdownText } from '../lib/markdown.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { buildLibraryBrowsePath, buildLibraryModalPath } from '../lib/library-modal-path.js';
import { LIBRARY_NON_CLONEABLE_COLLECTIONS } from '../lib/library-filter-config.js';
import { isOwnItem } from '../lib/constants.js';

const TABLE_ADDABLE_COLLECTIONS = new Set(['adversaries', 'environments', 'maps', 'scenes', 'adventures', 'characters']);
const DEFAULT_SCOPE = {
  collection: 'all',
  includeMine: true,
  includePublic: true,
  includeSrd: true,
};

const DEFAULT_PROMPTS = [
  'How do long rest options compare to short rest options?',
  'What domain cards would let me be more like Spiderman?',
  'Which trait would I use for swimming across a small lake?',
];

function normalizeReferenceItem(reference) {
  if (!reference?.item || !reference?.collection) return null;
  return {
    ...reference.item,
    _collection: reference.collection,
  };
}

function actionToBrowsePath(action) {
  const tab = action?.tab || 'all';
  return buildLibraryBrowsePath(tab, {
    search: action?.search || '',
    semantic: action?.semantic || '',
  });
}

export function LibraryAssistantPanel({
  data,
  navigate,
  mode = 'panel',
  onClose = null,
  onOpenItem = null,
  onCloneItem = null,
  onAddToTableItem = null,
  ownedTables = [],
  partySize = 1,
  partyTier = 1,
  characters = [],
  getAssistantContext = null,
}) {
  const { srdData: libraryCharacterSrdData } = useCharacterSrdData();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState('');

  const assistantContext = useMemo(
    () => (typeof getAssistantContext === 'function' ? getAssistantContext() : {}),
    [getAssistantContext]
  );

  const submitQuestion = useCallback(async (rawQuestion) => {
    const trimmed = String(rawQuestion || '').trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    try {
      const context = typeof getAssistantContext === 'function' ? getAssistantContext() : {};
      const result = await postLibraryAiAnswer({
        question: trimmed,
        scope: context.scope || DEFAULT_SCOPE,
        browseState: context.browseState || null,
      });
      setQuestion(trimmed);
      setAnswer(result);
    } catch (err) {
      setError(err?.message || 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  }, [getAssistantContext, loading]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    void submitQuestion(question);
  }, [question, submitQuestion]);

  const openReference = useCallback((item) => {
    const collection = item?._collection || 'all';
    if (typeof onOpenItem === 'function') {
      onOpenItem(item);
      return;
    }
    navigate(buildLibraryModalPath('all', collection, item.id));
    onClose?.();
  }, [navigate, onClose, onOpenItem]);

  const handleClone = useCallback(async (item) => {
    if (!onCloneItem) return;
    await onCloneItem(item);
  }, [onCloneItem]);

  const handleOpenInLibrary = useCallback((action) => {
    navigate(actionToBrowsePath(action));
    onClose?.();
  }, [navigate, onClose]);

  const promptButtons = useMemo(
    () => DEFAULT_PROMPTS.map((prompt) => (
      <button
        key={prompt}
        type="button"
        onClick={() => {
          setQuestion(prompt);
          void submitQuestion(prompt);
        }}
        className="rounded-lg border border-dh-strong bg-dh-raised/60 px-3 py-2 text-left text-sm text-dh hover:border-sky-500/50 hover:bg-dh-hover"
      >
        {prompt}
      </button>
    )),
    [submitQuestion]
  );

  const referenceItems = useMemo(
    () => (answer?.references || []).map(normalizeReferenceItem).filter(Boolean),
    [answer?.references]
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${mode === 'modal' ? 'bg-dh-surface' : ''}`}>
      <div className={`shrink-0 ${mode === 'modal' ? 'border-b border-dh-border px-5 py-4' : 'rounded-xl border border-dh-border bg-dh-surface p-5'}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-300">
            <Bot size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-dh">Library Assistant</h3>
            <p className="mt-1 text-sm text-dh-muted">
              Ask naturally. Answers default to all structured SRD and library content, and the assistant can attach matching library cards or open a semantic library search.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="sr-only">Ask the library assistant</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (e.shiftKey) return;
                e.preventDefault();
                void submitQuestion(question);
              }}
              placeholder="Ask a rules question, compare options, or describe the kind of thing you want…"
              className="min-h-[104px] w-full rounded-xl border border-dh-strong bg-dh-canvas px-4 py-3 text-sm text-dh outline-none transition-colors placeholder:text-dh-muted focus:border-sky-500/60"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Ask
            </button>
            <span className="text-xs text-dh-muted">
              {assistantContext?.browseState?.activeTab && assistantContext.browseState.activeTab !== 'assistant'
                ? `Current library context: ${assistantContext.browseState.activeTab.replace(/_/g, ' ')}`
                : 'Assistant scope: all structured library content'}
            </span>
          </div>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
        <div className={`flex flex-col gap-4 ${mode === 'modal' ? 'px-5 py-5' : 'pt-5'}`}>
          {!answer && !loading && !error && (
            <div className="rounded-xl border border-dh-border bg-dh-surface p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-dh">
                <Sparkles size={16} className="text-sky-400" />
                Good starting prompts
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {promptButtons}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {(loading || answer) && (
            <div className="rounded-xl border border-dh-border bg-dh-surface p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-dh">
                {loading ? <Loader2 size={16} className="animate-spin text-sky-400" /> : <Search size={16} className="text-sky-400" />}
                {loading ? 'Thinking through the library…' : 'Answer'}
              </div>
              {answer?.warnings?.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertTriangle size={14} />
                    Notes
                  </div>
                  <ul className="space-y-1">
                    {answer.warnings.map((warning, idx) => (
                      <li key={`${warning}-${idx}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {answer?.answerMarkdown ? (
                <MarkdownText text={answer.answerMarkdown} className="max-w-none text-dh" />
              ) : (
                loading && <p className="text-sm text-dh-muted">Gathering candidate rules and library references…</p>
              )}
              {Array.isArray(answer?.handoffActions) && answer.handoffActions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {answer.handoffActions.map((action, idx) => (
                    <button
                      key={`${action.label || action.tab || 'handoff'}-${idx}`}
                      type="button"
                      onClick={() => handleOpenInLibrary(action)}
                      className="inline-flex items-center gap-2 rounded-lg border border-dh-strong bg-dh-raised/70 px-3 py-2 text-sm text-dh hover:border-sky-500/50 hover:bg-dh-hover"
                    >
                      <ExternalLink size={14} />
                      {action.label || 'Open in Library'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {referenceItems.length > 0 && (
            <div className="rounded-xl border border-dh-border bg-dh-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-dh">
                <Search size={16} className="text-sky-400" />
                References
              </div>
              <div className="flex flex-wrap gap-2">
                {referenceItems.map((item) => {
                  const collection = item._collection || 'all';
                  const canClone = onCloneItem && !LIBRARY_NON_CLONEABLE_COLLECTIONS.has(collection);
                  const canAddToTable = onAddToTableItem && TABLE_ADDABLE_COLLECTIONS.has(collection);
                  return (
                    <ItemCard
                      key={`${collection}-${item.id}`}
                      item={item}
                      tab={collection}
                      data={data}
                      onView={openReference}
                      onEdit={isOwnItem(item) ? openReference : null}
                      onDelete={null}
                      onClone={canClone ? () => handleClone(item) : undefined}
                      onAddToTable={canAddToTable ? (entry, collectionName, tableId) => onAddToTableItem(entry, collectionName, tableId) : undefined}
                      ownedTables={canAddToTable ? ownedTables : null}
                      partySize={partySize}
                      partyTier={partyTier}
                      showSourceBadge
                      srdData={libraryCharacterSrdData}
                      characters={characters}
                      cardWidth={340}
                      cardHeight={196}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryAssistantModal({
  open,
  onClose,
  ...panelProps
}) {
  return (
    <FullPageOverlay
      open={open}
      onClose={onClose}
      ariaLabelledBy="library-assistant-title"
      maxWidthClass="max-w-6xl"
      heightClass="h-[min(90vh,940px)]"
    >
      <FullPageOverlayHeader
        title="Library Assistant"
        titleId="library-assistant-title"
        icon={Bot}
        onClose={onClose}
      />
      <LibraryAssistantPanel
        {...panelProps}
        mode="modal"
        onClose={onClose}
      />
    </FullPageOverlay>
  );
}
