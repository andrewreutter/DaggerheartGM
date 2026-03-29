import { useEffect } from 'react';
import { Sparkles, Check, RotateCcw, Loader2, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';

/**
 * Shared AI image prompt + preview UI (Hugging Face generate/edit) used by ImageGenerator and MapAiImageDialog.
 */
export function AiImageWorkbench({
  editedPrompt,
  onEditedPromptChange,
  onRebuildPrompt,
  rebuildButtonTitle = 'Rebuild from item data',
  rebuildDisabled = false,
  generating,
  error,
  imageHistory,
  historyIndex,
  onHistoryIndexChange,
  onGenerate,
  onEdit,
  editOpen,
  onEditOpenChange,
  editInstruction,
  onEditInstructionChange,
  onUse,
  showUseButton = true,
  useButtonLabel = 'Use this image',
  lightboxOpen,
  onLightboxOpenChange,
  inline = false,
  promptRows = 8,
  previewMaxClass = 'max-h-64',
}) {
  const currentPreview = historyIndex >= 0 ? imageHistory[historyIndex] : null;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < imageHistory.length - 1;

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onLightboxOpenChange(false);
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [lightboxOpen, onLightboxOpenChange]);

  return (
    <>
      <div className={`p-3 bg-dh-surface border border-purple-800/60 rounded-lg space-y-3 ${inline ? 'mt-2 w-full basis-full' : 'mt-2'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
            <Sparkles size={12} />
            AI Image Prompt
          </span>
          {onRebuildPrompt ? (
            <button
              type="button"
              onClick={onRebuildPrompt}
              disabled={rebuildDisabled || generating}
              className="flex items-center gap-1 text-xs text-dh-muted hover:text-dh transition-colors disabled:opacity-50"
              title={rebuildButtonTitle}
            >
              <RotateCcw size={11} />
              {rebuildButtonTitle}
            </button>
          ) : null}
        </div>

        <textarea
          value={editedPrompt}
          onChange={e => onEditedPromptChange(e.target.value)}
          disabled={generating}
          rows={promptRows}
          className="w-full bg-dh-inset border border-dh-border rounded p-2 text-sm text-dh resize-y disabled:opacity-50 focus:border-purple-600 focus:outline-none"
          placeholder="Describe the image you want to generate..."
        />

        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : null}

        {currentPreview ? (
          <div className="space-y-2">
            <div className="relative">
              <img
                src={currentPreview}
                alt="Generated preview"
                onClick={() => onLightboxOpenChange(true)}
                className={`w-full rounded border border-dh-border ${previewMaxClass} object-contain bg-dh-inset cursor-zoom-in`}
              />
              {imageHistory.length > 1 ? (
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onHistoryIndexChange(i => i - 1)}
                    disabled={!canGoBack}
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded-full">
                    {historyIndex + 1} / {imageHistory.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => onHistoryIndexChange(i => i + 1)}
                    disabled={!canGoForward}
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 flex-wrap">
              {showUseButton && onUse ? (
                <button
                  type="button"
                  onClick={onUse}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                >
                  <Check size={12} />
                  {useButtonLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating || !editedPrompt.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Generate Another
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onEditOpenChange(o => !o)}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-dh-hover hover:bg-dh-hover disabled:opacity-50 disabled:cursor-not-allowed text-dh transition-colors"
              >
                <Wand2 size={12} />
                Edit this image
              </button>
            </div>

            {editOpen ? (
              <div className="flex gap-2 items-start pt-1">
                <input
                  type="text"
                  value={editInstruction}
                  onChange={e => onEditInstructionChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !generating && editInstruction.trim()) onEdit(); }}
                  disabled={generating}
                  placeholder="e.g. make the background darker, add a sword…"
                  className="flex-1 bg-dh-inset border border-dh-border rounded px-2 py-1.5 text-xs text-dh placeholder-dh-muted disabled:opacity-50 focus:border-purple-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={generating || !editInstruction.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap"
                >
                  {generating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Editing…
                    </>
                  ) : (
                    <>
                      <Wand2 size={12} />
                      Apply Edit
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || !editedPrompt.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {generating ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={12} />
                Generate
              </>
            )}
          </button>
        )}
      </div>

      {lightboxOpen && currentPreview ? (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => onLightboxOpenChange(false)}
        >
          <button
            type="button"
            onClick={() => onLightboxOpenChange(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-1.5 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={currentPreview}
            alt="Generated image (enlarged)"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
