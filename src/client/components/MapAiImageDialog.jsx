import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateImage, editImage, postMapImageFile } from '../lib/api.js';
import { buildBattleMapDefaultPrompt } from '../lib/ai-image-prompts.js';
import { imageSrcToDataUrlForApi, loadImageNaturalSizeFromUrl } from '../lib/map-image-data-url.js';
import { FullPageOverlay, FullPageOverlayHeader } from './FullPageOverlay.jsx';
import { AiImageWorkbench } from './AiImageWorkbench.jsx';

/**
 * Modal: generate/edit a battle map with Hugging Face, upload the result via POST /api/room/my/map-image, then apply with set-map.
 */
export function MapAiImageDialog({
  open,
  onClose,
  mapSizeFt = 100,
  mapImageUrl,
  /** Persisted prompt from the last Save for this map image */
  savedMapAiImagePrompt,
  onMapConfigChange,
}) {
  const [editedPrompt, setEditedPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageHistory, setImageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  const latestRef = useRef({ mapSizeFt, mapImageUrl, savedMapAiImagePrompt });
  latestRef.current = { mapSizeFt, mapImageUrl, savedMapAiImagePrompt };

  const currentPreview = historyIndex >= 0 ? imageHistory[historyIndex] : null;

  useEffect(() => {
    if (!open) return;
    const { mapSizeFt: ft, mapImageUrl: img, savedMapAiImagePrompt: saved } = latestRef.current;
    setError(null);
    setSaving(false);
    const prompt = (saved && String(saved).trim())
      ? String(saved).trim()
      : buildBattleMapDefaultPrompt(ft);
    setEditedPrompt(prompt);
    if (img) {
      setImageHistory([img]);
      setHistoryIndex(0);
    } else {
      setImageHistory([]);
      setHistoryIndex(-1);
    }
    setEditOpen(false);
    setEditInstruction('');
    setLightboxOpen(false);
  }, [open]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
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
      const dataUrl = await imageSrcToDataUrlForApi(currentPreview);
      const { imageUrl } = await editImage(dataUrl, editInstruction.trim());
      setImageHistory(prev => [...prev, imageUrl]);
      setHistoryIndex(prev => prev + 1);
    } catch (err) {
      setError(err.message || 'Image editing failed.');
    } finally {
      setGenerating(false);
    }
  }, [currentPreview, editInstruction]);

  const rebuildPrompt = () => {
    setEditedPrompt(buildBattleMapDefaultPrompt(latestRef.current.mapSizeFt));
  };

  const handleSave = async () => {
    if (!currentPreview || saving || generating) return;
    setError(null);
    setSaving(true);
    try {
      const dataUrl = await imageSrcToDataUrlForApi(currentPreview);
      const { width, height } = await loadImageNaturalSizeFromUrl(dataUrl);
      const blob = await fetch(dataUrl).then(r => r.blob());
      const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
      const file = new File([blob], `battle-map.${ext}`, { type: mime });
      const { url } = await postMapImageFile(file);
      if (!url) throw new Error('Upload did not return a URL');
      onMapConfigChange(
        {
          mapImageUrl: url,
          mapImageNaturalWidth: width,
          mapImageNaturalHeight: height,
          mapAiImagePrompt: editedPrompt.trim() || null,
        },
        true,
      );
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save map image.');
    } finally {
      setSaving(false);
    }
  };

  const busy = generating || saving;
  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <FullPageOverlay
      open={open}
      onClose={requestClose}
      maxWidthClass="max-w-3xl"
      heightClass="max-h-[min(92vh,920px)]"
      zIndexClass="z-[200]"
      ariaLabelledBy="map-ai-dialog-title"
    >
      <FullPageOverlayHeader
        titleId="map-ai-dialog-title"
        title="Generate battle map"
        icon={Sparkles}
        onClose={requestClose}
        subtitle="Hugging Face — generate, edit, then save to upload and apply"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <AiImageWorkbench
            editedPrompt={editedPrompt}
            onEditedPromptChange={setEditedPrompt}
            onRebuildPrompt={rebuildPrompt}
            rebuildButtonTitle="Rebuild default prompt"
            generating={busy}
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
            showUseButton={false}
            lightboxOpen={lightboxOpen}
            onLightboxOpenChange={setLightboxOpen}
            inline
            promptRows={6}
            previewMaxClass="max-h-72"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-dh-strong px-4 py-3">
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className="rounded-md border border-dh-border px-4 py-2 text-sm text-dh hover:bg-dh-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!currentPreview || busy}
            className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </FullPageOverlay>
  );
}
