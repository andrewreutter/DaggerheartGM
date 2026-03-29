import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from './FullPageOverlay.jsx';
import { MapAiImageBuilderPanel } from './MapAiImageBuilderPanel.jsx';

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
  onGenerationPreviewChange,
}) {
  const [busy, setBusy] = useState(false);
  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

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
      <MapAiImageBuilderPanel
        className="flex-1 min-h-0"
        mapSizeFt={mapSizeFt}
        mapImageUrl={mapImageUrl}
        savedMapAiImagePrompt={savedMapAiImagePrompt}
        onMapConfigChange={onMapConfigChange}
        onGenerationPreviewChange={onGenerationPreviewChange}
        onCancel={requestClose}
        onSaved={onClose}
        onBusyChange={setBusy}
        showCancel
      />
    </FullPageOverlay>
  );
}
