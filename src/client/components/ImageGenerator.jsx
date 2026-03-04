import { useState, useCallback, useEffect } from 'react';
import { Sparkles, Check, RotateCcw, Loader2, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import { generateImage, editImage, imageGenEnabled } from '../lib/api.js';

/** Strip markdown syntax characters that clutter image prompts. */
function stripMd(text) {
  return (text || '').replace(/[*_`#>~\[\]]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Build a text-to-image prompt from item flavor text, tailored per collection type.
 * Structure: subject line, then user description, then labeled game-data segments.
 */
function buildImagePrompt(formData, collection) {
  const lines = [];

  if (collection === 'adversaries') {
    const { name, tier, role, description, motive, attack, experiences, features } = formData || {};
    const tierStr = tier ? `tier ${tier} of 4` : null;
    const roleLine = [tierStr, role].filter(Boolean).join(' ');
    lines.push(`A dark fantasy TTRPG illustration of ${stripMd(name) || 'a creature'}${roleLine ? `, a ${roleLine}` : ''}.`);

    if (description?.trim()) lines.push('', stripMd(description));

    if (motive?.trim()) lines.push('', `Motives & Tactics: ${stripMd(motive)}`);

    if (attack?.name?.trim()) lines.push('', `Attack: ${stripMd(attack.name)}`);

    const expNames = (experiences || []).map(e => stripMd(e.name)).filter(Boolean);
    if (expNames.length) lines.push('', `Experiences: ${expNames.join(', ')}`);

    const featParts = (features || []).map(f => {
      const name = stripMd(f.name);
      const desc = stripMd(f.description);
      return [name, desc].filter(Boolean).join(' — ');
    }).filter(Boolean);
    if (featParts.length) lines.push('', `Features: ${featParts.join(' | ')}`);

  } else if (collection === 'environments') {
    const { name, description, impulses, potential_adversaries, features } = formData || {};
    lines.push(`A dark fantasy TTRPG landscape: ${stripMd(name) || 'a mysterious place'}.`);

    if (description?.trim()) lines.push('', stripMd(description));

    if (impulses?.trim()) lines.push('', `Impulses: ${stripMd(impulses)}`);

    const advNames = (potential_adversaries || []).map(a => stripMd(a.name)).filter(Boolean);
    if (advNames.length) lines.push('', `Potential Adversaries: ${advNames.join(', ')}`);

    const featParts = (features || []).map(f => {
      const name = stripMd(f.name);
      const desc = stripMd(f.description);
      return [name, desc].filter(Boolean).join(' — ');
    }).filter(Boolean);
    if (featParts.length) lines.push('', `Features: ${featParts.join(' | ')}`);

  } else if (collection === 'scenes') {
    const { name, description } = formData || {};
    lines.push(`A dark fantasy TTRPG scene: ${stripMd(name) || 'an encounter'}.`);
    if (description?.trim()) lines.push('', stripMd(description));

  } else {
    // adventures
    const { name } = formData || {};
    lines.push(`A dark fantasy TTRPG adventure setting: ${stripMd(name) || 'an epic quest'}.`);
  }

  return lines.join('\n').trim();
}

/**
 * Inline AI image generator panel for item editor forms.
 *
 * Props:
 *   formData   — the current form data object
 *   collection — 'adversaries' | 'environments' | 'scenes' | 'adventures'
 *   onImageGenerated(dataUrl) — called with the result data URL to set formData.imageUrl
 */
export function ImageGenerator({ formData, collection, onImageGenerated, inline = false }) {
  const [open, setOpen] = useState(false);
  const [lastPrompt, setLastPrompt] = useState(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  // History stack of generated/edited image data URLs
  const [imageHistory, setImageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Edit section state
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  const currentPreview = historyIndex >= 0 ? imageHistory[historyIndex] : null;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < imageHistory.length - 1;

  // Intercept Escape in capture phase so it closes the lightbox instead of the parent modal.
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setLightboxOpen(false);
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [lightboxOpen]);

  if (!imageGenEnabled) return null;

  const openPanel = () => {
    if (!open) {
      // First open: compile from form data; subsequent opens: retain last edited prompt
      if (lastPrompt === null) {
        setEditedPrompt(buildImagePrompt(formData, collection));
      }
      // Preload existing image so Edit option is available
      if (formData?.imageUrl && imageHistory.length === 0) {
        setImageHistory([formData.imageUrl]);
        setHistoryIndex(0);
      }
    }
    setOpen(o => !o);
  };

  const rebuildPrompt = () => {
    setEditedPrompt(buildImagePrompt(formData, collection));
  };

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    setLastPrompt(editedPrompt);
    try {
      const { imageUrl } = await generateImage(editedPrompt);
      setImageHistory(prev => [...prev, imageUrl]);
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Image generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [editedPrompt]);

  const handleEdit = useCallback(async () => {
    if (!currentPreview || !editInstruction.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const { imageUrl } = await editImage(currentPreview, editInstruction.trim());
      setImageHistory(prev => [...prev, imageUrl]);
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Image editing failed.');
    } finally {
      setGenerating(false);
    }
  }, [currentPreview, editInstruction]);

  const handleUse = () => {
    onImageGenerated(currentPreview);
    setImageHistory([]);
    setHistoryIndex(-1);
    setEditOpen(false);
    setOpen(false);
  };

  const buttonEl = (
    <button
      type="button"
      onClick={openPanel}
      className={`flex items-center justify-center gap-1.5 text-xs transition-colors shrink-0 cursor-pointer ${
        inline
          ? 'h-full min-h-[2.5rem] min-w-[7.5rem] px-3 rounded-none border-l border-slate-700 text-purple-300 hover:text-purple-100 bg-slate-900/80 hover:bg-slate-800/80'
          : 'px-2 py-1 rounded border border-purple-800/50 hover:border-purple-600 text-purple-300 hover:text-purple-100 bg-purple-950/30 hover:bg-purple-900/40'
      }`}
    >
      <Sparkles size={12} />
      Generate with AI
    </button>
  );

  const panelEl = open && (
    <div className={`p-3 bg-slate-900 border border-purple-800/60 rounded-lg space-y-3 ${inline ? 'mt-2 w-full basis-full' : 'mt-2'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
              <Sparkles size={12} />
              AI Image Prompt
            </span>
            <button
              type="button"
              onClick={rebuildPrompt}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              title="Rebuild prompt from current item data"
            >
              <RotateCcw size={11} />
              Rebuild from item data
            </button>
          </div>

          <textarea
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            disabled={generating}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white resize-y disabled:opacity-50 focus:border-purple-600 focus:outline-none"
            placeholder="Describe the image you want to generate..."
          />

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {currentPreview ? (
            <div className="space-y-2">
              {/* Image with back/forward navigation overlay */}
              <div className="relative">
                <img
                  src={currentPreview}
                  alt="Generated preview"
                  onClick={() => setLightboxOpen(true)}
                  className="w-full rounded border border-slate-700 max-h-64 object-contain bg-slate-950 cursor-zoom-in"
                />
                {imageHistory.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryIndex(i => i - 1)}
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
                      onClick={() => setHistoryIndex(i => i + 1)}
                      disabled={!canGoForward}
                      className="flex items-center justify-center w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUse}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                >
                  <Check size={12} />
                  Use this image
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
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
                  onClick={() => setEditOpen(o => !o)}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <Wand2 size={12} />
                  Edit this image
                </button>
              </div>

              {editOpen && (
                <div className="flex gap-2 items-start pt-1">
                  <input
                    type="text"
                    value={editInstruction}
                    onChange={e => setEditInstruction(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !generating && editInstruction.trim()) handleEdit(); }}
                    disabled={generating}
                    placeholder="e.g. make the background darker, add a sword…"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 disabled:opacity-50 focus:border-purple-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleEdit}
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
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
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
  );

  return (
    <>
      {inline ? (
        <>
          {buttonEl}
          {panelEl}
        </>
      ) : (
        <div className="mt-1">
          {buttonEl}
          {panelEl}
        </div>
      )}
      {lightboxOpen && currentPreview && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
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
      )}
    </>
  );
}
