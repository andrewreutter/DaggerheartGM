import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image, Map, RefreshCw, Import, X, Loader2, ImagePlus } from 'lucide-react';

/**
 * Popover menu for image paste/drop actions. Shown when the user pastes/drops an image on
 * the game table, clicks the draw-toolbar image button, or has an editable item modal open.
 *
 * Each callback prop, when null, hides that option from the menu.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {File | null} props.seedFile — pre-supplied file (paste/drop); null = toolbar mode (file picker shown after choice)
 * @param {((file: File) => Promise<void>) | null} props.onNewMap — null hides the option
 * @param {((file: File) => Promise<void>) | null} props.onReplaceMap — null hides the option
 * @param {((file: File) => Promise<void>) | null} props.onNewImageObject — null hides the option
 * @param {((file?: File) => void) | null} props.onImportTools — null hides the option
 * @param {{ key: string, label: string, onAdd: (file: File) => Promise<void> }[]} [props.addToItemTargets] — one "Add image to [Label]" option per entry; empty/omitted hides the section
 */
export function MapImageQuickPickMenu({
  open,
  onClose,
  seedFile,
  onNewMap,
  onReplaceMap,
  onNewImageObject,
  onImportTools,
  addToItemTargets = [],
}) {
  const [loading, setLoading] = useState(null);
  const [pendingCallback, setPendingCallback] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setLoading(null);
      setPendingCallback(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  // Previously errors here were console.error-only, so a failed upload (e.g. a large pasted
  // screenshot hitting the 10MB map-image limit or a network/proxy size limit) silently closed
  // the menu with nothing placed and no indication anything went wrong. Surface it.
  const reportError = (err) => {
    console.error('[MapImageQuickPickMenu]', err);
    alert(`Failed to add image: ${err?.message || err}. It may be too large (10MB limit) — try a smaller image.`);
  };

  const handleAction = async (key, callback) => {
    if (seedFile) {
      setLoading(key);
      try { await callback(seedFile); } catch (err) { reportError(err); }
      setLoading(null);
      onClose();
    } else {
      // Toolbar mode: open file picker, run callback after file selection
      setPendingCallback(() => callback);
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingCallback) return;
    const cb = pendingCallback;
    setPendingCallback(null);
    setLoading('file');
    try { await cb(file); } catch (err) { reportError(err); }
    setLoading(null);
    onClose();
  };

  const btnClass = 'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-dh-hover text-dh disabled:opacity-40 disabled:cursor-not-allowed';
  const isLoading = loading !== null;

  const hasMapOptions = !!(onNewMap || onReplaceMap || onNewImageObject);
  const hasAddToItemTargets = addToItemTargets.length > 0;
  const truncateLabel = (label) => (label && label.length > 22 ? label.slice(0, 20) + '…' : (label || 'this item'));

  return createPortal(
    <div
      // z-[200] matches the app-wide "dialog that must sit above an open ItemDetailModal
      // (z-[80]/[81])" convention (AdversaryStatChangeModal, SceneAdoptDialog, FullPageOverlay,
      // CharacterHoverCard/DiceRoller target menus, etc.) — this menu is commonly opened via
      // paste/drop while editing an adversary/character/environment in ItemDetailModal, so it
      // must render above that modal's backdrop and body, not behind it.
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
    >
      <div
        className="bg-dh-raised border border-dh-strong rounded-xl shadow-2xl p-3 w-64 flex flex-col gap-0.5"
        role="dialog"
        aria-modal="true"
        aria-label="Add image"
      >
        <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-dh-border">
          <span className="font-semibold text-dh text-sm">Add Image</span>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded text-dh-muted hover:text-white transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Add image to the open item and/or its extra targets (e.g. a companion) — shown first */}
        {addToItemTargets.map((target) => {
          const key = `add-to-item-${target.key}`;
          const label = truncateLabel(target.label);
          return (
            <button
              key={key}
              className={btnClass}
              disabled={isLoading}
              onClick={() => handleAction(key, target.onAdd)}
              title={`Add this image to ${label}`}
            >
              {loading === key ? <Loader2 size={15} className="animate-spin shrink-0" /> : <ImagePlus size={15} className="shrink-0 text-emerald-400" />}
              <span className="min-w-0">
                <span className="font-medium">Add to "{label}"</span>
                <span className="block text-[11px] text-dh-muted leading-tight">Set as image for {label}</span>
              </span>
            </button>
          );
        })}

        {/* Divider between item and map options */}
        {hasAddToItemTargets && hasMapOptions && (
          <div className="my-0.5 border-t border-dh-border/60" />
        )}

        {/* New Map */}
        {onNewMap && (
          <button
            className={btnClass}
            disabled={isLoading}
            onClick={() => handleAction('new-map', onNewMap)}
            title="Add a new map layer with this image"
          >
            {loading === 'new-map' ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Map size={15} className="shrink-0 text-violet-400" />}
            <span className="min-w-0">
              <span className="font-medium">New Map</span>
              <span className="block text-[11px] text-dh-muted leading-tight">Adds a new map with this image</span>
            </span>
          </button>
        )}

        {/* Replace Map */}
        {onReplaceMap && (
          <button
            className={btnClass}
            disabled={isLoading}
            onClick={() => handleAction('replace-map', onReplaceMap)}
            title="Replace the current map image"
          >
            {loading === 'replace-map' ? <Loader2 size={15} className="animate-spin shrink-0" /> : <RefreshCw size={15} className="shrink-0 text-amber-400" />}
            <span className="min-w-0">
              <span className="font-medium">Replace Map</span>
              <span className="block text-[11px] text-dh-muted leading-tight">Swaps the current map's image</span>
            </span>
          </button>
        )}

        {/* New Image on Map */}
        {onNewImageObject && (
          <button
            className={btnClass}
            disabled={isLoading}
            onClick={() => handleAction('image-object', onNewImageObject)}
            title="Place a resizable image on the map canvas"
          >
            {loading === 'image-object' ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Image size={15} className="shrink-0 text-sky-400" />}
            <span className="min-w-0">
              <span className="font-medium">New Image on Map</span>
              <span className="block text-[11px] text-dh-muted leading-tight">Place a draggable image on the map</span>
            </span>
          </button>
        )}

        {/* Import Tools — only shown when enabled (GM) */}
        {onImportTools && (
          <button
            className={btnClass}
            disabled={isLoading}
            onClick={() => { onImportTools(seedFile ?? undefined); onClose(); }}
            title="Open the full import tools"
          >
            <Import size={15} className="shrink-0 text-dh-muted" />
            <span className="min-w-0">
              <span className="font-medium">Import Tools</span>
              <span className="block text-[11px] text-dh-muted leading-tight">OCR, stat block parsing, and more</span>
            </span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>,
    document.body,
  );
}
