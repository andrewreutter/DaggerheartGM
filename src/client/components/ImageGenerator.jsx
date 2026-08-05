import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { generateImage, editImage, imageGenEnabled, postImageUpload } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowImageGenAiUi } from '../lib/ai-ui-visibility.js';
import { buildImagePrompt } from '../lib/ai-image-prompts.js';
import { dataUrlToFile, imageSrcToDataUrlForApi } from '../lib/map-image-data-url.js';
import { AiImageWorkbench } from './AiImageWorkbench.jsx';

/**
 * Inline AI image generator panel for item editor forms.
 *
 * Props:
 *   formData   — the current form data object
 *   collection — 'adversaries' | 'environments' | 'scenes' | 'adventures'
 *   onImageGenerated(dataUrl) — called with the result data URL to set formData.imageUrl
 */
export function ImageGenerator({ formData, collection, onImageGenerated, inline = false }) {
  const { hideAiUi } = useAiUiPreference();
  const [open, setOpen] = useState(false);
  const [lastPrompt, setLastPrompt] = useState(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageHistory, setImageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  const currentPreview = historyIndex >= 0 ? imageHistory[historyIndex] : null;

  const openPanel = () => {
    if (!open) {
      if (lastPrompt === null) {
        setEditedPrompt(buildImagePrompt(formData, collection));
      }
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

  const uploadGeneratedDataUrl = useCallback(async (dataUrl) => {
    try {
      const file = await dataUrlToFile(dataUrl, 'ai-image');
      const { url } = await postImageUpload(file);
      return url;
    } catch {
      // Fall back to the raw data URL if upload fails (local dev without Supabase, etc.)
      return dataUrl;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    setLastPrompt(editedPrompt);
    try {
      const { imageUrl: rawUrl } = await generateImage(editedPrompt);
      const url = await uploadGeneratedDataUrl(rawUrl);
      setImageHistory(prev => [...prev, url]);
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Image generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [editedPrompt, uploadGeneratedDataUrl]);

  const handleEdit = useCallback(async () => {
    if (!currentPreview || !editInstruction.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const dataUrl = await imageSrcToDataUrlForApi(currentPreview);
      const { imageUrl: rawUrl } = await editImage(dataUrl, editInstruction.trim());
      const url = await uploadGeneratedDataUrl(rawUrl);
      setImageHistory(prev => [...prev, url]);
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Image editing failed.');
    } finally {
      setGenerating(false);
    }
  }, [currentPreview, editInstruction, uploadGeneratedDataUrl]);

  const handleUse = () => {
    onImageGenerated(currentPreview);
    setImageHistory([]);
    setHistoryIndex(-1);
    setEditOpen(false);
    setOpen(false);
  };

  if (!shouldShowImageGenAiUi(imageGenEnabled, hideAiUi)) return null;

  const buttonEl = (
    <button
      type="button"
      tabIndex={0}
      onClick={openPanel}
      className={`flex items-center justify-center gap-1.5 text-xs transition-colors shrink-0 cursor-pointer ${
        inline
          ? 'h-full min-h-[2.5rem] min-w-[7.5rem] px-3 rounded-none border-l border-dh-border text-purple-300 hover:text-purple-100 bg-dh-surface/80 hover:bg-dh-raised/80'
          : 'px-2 py-1 rounded border border-purple-800/50 hover:border-purple-600 text-purple-300 hover:text-purple-100 bg-purple-950/30 hover:bg-purple-900/40'
      }`}
    >
      <Sparkles size={12} />
      Generate with AI
    </button>
  );

  const panelEl = open && (
    <AiImageWorkbench
      editedPrompt={editedPrompt}
      onEditedPromptChange={setEditedPrompt}
      onRebuildPrompt={rebuildPrompt}
      generating={generating}
      error={error}
      imageHistory={imageHistory}
      historyIndex={historyIndex}
      onHistoryIndexChange={setHistoryIndex}
      onGenerate={handleGenerate}
      onEdit={handleEdit}
      editOpen={editOpen}
      onEditOpenChange={setEditOpen}
      editInstruction={editInstruction}
      onEditInstructionChange={setEditInstruction}
      onUse={handleUse}
      showUseButton
      useButtonLabel="Use this image"
      lightboxOpen={lightboxOpen}
      onLightboxOpenChange={setLightboxOpen}
      inline={inline}
    />
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
    </>
  );
}

export { buildImagePrompt, buildBattleMapDefaultPrompt } from '../lib/ai-image-prompts.js';
