import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image, FileText, Loader2, ArrowLeftRight, Map as MapIcon, Maximize2 } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { getAuthToken } from '../../lib/api.js';
import {
  ImportModalShell,
  ImportPreviewSection,
  ImportPreviewSummary,
  useImportSelection,
} from './ImportModalShell.jsx';
import { ImportPreviewCard } from './ImportPreviewCard.jsx';

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

const COLLECTION_LABELS = { adversaries: 'Adversary', environments: 'Environment' };

/**
 * Single-page import modal for Daggerheart stat blocks.
 *
 * Images are auto-parsed as they're added/removed (debounced). Each image can
 * be toggled between parsed (OCR) and "Scene img" (artwork). Once parsed, the
 * thumbnail label updates to the detected type (Adversary / Environment).
 * An optional "Create a Scene" toggle assembles a scene from the parsed
 * adversaries/environments with scene-marked images as artwork.
 */
export function ImageImportModal({ onClose, saveItem, data, onImportSuccess }) {
  const [files, setFiles] = useState([]);
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [sceneImageKeys, setSceneImageKeys] = useState(new Set());
  // Maps file key → detected collection after parsing (e.g. 'adversaries')
  const [fileCollections, setFileCollections] = useState(new Map());

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedItems, setParsedItems] = useState([]);

  const [createScene, setCreateScene] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');

  const [importing, setImporting] = useState(false);

  // Lightbox: key of the image to display full-size, or null
  const [lightboxKey, setLightboxKey] = useState(null);

  const { selectedIds, setSelectedIds, toggleId, replaceIds, toggleReplaceId } = useImportSelection();

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const parseGenRef = useRef(0);

  useEffect(() => {
    return () => files.forEach(f => URL.revokeObjectURL(f.previewUrl));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // File management
  // ---------------------------------------------------------------------------

  const addFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setFiles(prev => [
      ...prev,
      ...imageFiles.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        key: generateId(),
      })),
    ]);
    setParseError('');
  }, []);

  const removeFile = (idx) => {
    setFiles(prev => {
      const removed = prev[idx];
      URL.revokeObjectURL(removed.previewUrl);
      setSceneImageKeys(sk => {
        if (!sk.has(removed.key)) return sk;
        const next = new Set(sk);
        next.delete(removed.key);
        return next;
      });
      setFileCollections(fc => {
        if (!fc.has(removed.key)) return fc;
        const next = new Map(fc);
        next.delete(removed.key);
        return next;
      });
      if (lightboxKey === removed.key) setLightboxKey(null);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toggleImageRole = (key) => {
    const isCurrentlyScene = sceneImageKeys.has(key);
    setSceneImageKeys(prev => {
      const next = new Set(prev);
      if (isCurrentlyScene) next.delete(key);
      else next.add(key);
      return next;
    });
    if (!isCurrentlyScene) setCreateScene(true);
  };

  // ---------------------------------------------------------------------------
  // Drag-and-drop
  // ---------------------------------------------------------------------------

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget)) setIsDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ---------------------------------------------------------------------------
  // Clipboard paste
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();
      addFiles(imageItems.map(it => it.getAsFile()).filter(Boolean));
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  // ---------------------------------------------------------------------------
  // Auto-parse: fires whenever stat-block images or pasted text change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const statBlockFiles = files.filter(f => !sceneImageKeys.has(f.key));
    const hasText = pastedText.trim().length > 0;

    if (statBlockFiles.length === 0 && !hasText) {
      setParsedItems([]);
      setParseError('');
      setParsing(false);
      setFileCollections(new Map());
      return;
    }

    const gen = ++parseGenRef.current;
    setParsing(true);

    const timer = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const fd = new FormData();
        statBlockFiles.forEach(({ file }) => fd.append('images', file));
        if (hasText) fd.append('text', pastedText.trim());

        const res = await fetch('/api/import/parse', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server error ${res.status}`);
        }
        const { results } = await res.json();
        if (gen !== parseGenRef.current) return;

        if (!results || results.length === 0) {
          setParsedItems([]);
          setFileCollections(new Map());
          setParseError('No stat blocks detected. Try higher-resolution images or paste text directly.');
          return;
        }

        const withIds = results.map(r => ({
          ...r,
          item: { ...r.item, id: r.item.id || generateId() },
        }));
        setParsedItems(withIds);
        setSelectedIds(new Set(withIds.map(r => r.item.id)));
        setParseError('');

        // Build file key → detected collection mapping using sourceIndex
        const newFC = new Map();
        for (const r of results) {
          if (r.sourceIndex >= 0 && r.sourceIndex < statBlockFiles.length) {
            newFC.set(statBlockFiles[r.sourceIndex].key, r.collection);
          }
        }
        setFileCollections(newFC);
      } catch (err) {
        if (gen !== parseGenRef.current) return;
        setParseError(err.message || 'Failed to parse.');
      } finally {
        if (gen === parseGenRef.current) setParsing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [files, sceneImageKeys, pastedText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Collection override & inline edits
  // ---------------------------------------------------------------------------

  const toggleItemCollection = (itemId) => {
    setParsedItems(prev => prev.map(r => {
      if (r.item.id !== itemId) return r;
      const next = r.collection === 'adversaries' ? 'environments' : 'adversaries';
      return { ...r, collection: next };
    }));
  };

  const updateItem = (updatedItem) => {
    setParsedItems(prev => prev.map(r =>
      r.item.id === updatedItem.id ? { ...r, item: updatedItem } : r
    ));
  };

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = async () => {
    setImporting(true);
    const saved = [];

    for (const { collection, item } of parsedItems) {
      if (!selectedIds.has(item.id)) continue;

      const existingItems = data[collection] || [];
      const duplicate = existingItems.find(
        e => e.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      const replace = replaceIds.has(item.id);
      const id = replace && duplicate ? duplicate.id : (item.id || generateId());
      const { count: _count, id: _id, ...itemData } = item;

      try {
        const savedItem = await saveItem(collection, { ...itemData, id });
        saved.push({ ...savedItem, collection, replaced: !!(replace && duplicate), count: item.count });
      } catch (err) {
        console.error(`[import] Failed to save ${collection} "${item.name}":`, err);
      }
    }

    if (createScene) {
      const sceneImageFiles = files.filter(f => sceneImageKeys.has(f.key));
      let sceneImageUrl = '';
      if (sceneImageFiles.length > 0) {
        sceneImageUrl = await fileToDataUrl(sceneImageFiles[0].file);
      }

      const sceneData = {
        id: generateId(),
        name: sceneName || 'Imported Scene',
        description: sceneDescription,
        imageUrl: sceneImageUrl,
        adversaries: saved
          .filter(s => s.collection === 'adversaries')
          .map(s => ({ adversaryId: s.id, count: s.count || 1 })),
        environments: saved
          .filter(s => s.collection === 'environments')
          .map(s => s.id),
        scenes: [],
      };

      try {
        const savedScene = await saveItem('scenes', sceneData);
        onImportSuccess('scenes', savedScene.id);
      } catch (err) {
        console.error('[import] Failed to save scene:', err);
        if (saved.length > 0) onImportSuccess(saved[0].collection, saved[0].id);
      }
      setImporting(false);
      return;
    }

    setImporting(false);
    if (saved.length > 0) {
      onImportSuccess(saved[0].collection, saved[0].id);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const adversaries = parsedItems.filter(r => r.collection === 'adversaries').map(r => r.item);
  const environments = parsedItems.filter(r => r.collection === 'environments').map(r => r.item);
  const selectedCount = parsedItems.filter(r => selectedIds.has(r.item.id)).length;
  const sceneImageCount = files.filter(f => sceneImageKeys.has(f.key)).length;
  const totalImportCount = selectedCount + (createScene ? 1 : 0);
  const hasContent = files.length > 0 || pastedText.trim();

  const summaryParts = [];
  if (createScene) summaryParts.push('1 scene');
  const byCol = parsedItems
    .filter(r => selectedIds.has(r.item.id))
    .reduce((acc, r) => { acc[r.collection] = (acc[r.collection] || 0) + 1; return acc; }, {});
  Object.entries(byCol).forEach(([col, n]) => summaryParts.push(`${n} ${col}`));
  const summaryStr = summaryParts.length > 0 ? summaryParts.join(' \u00b7 ') : null;

  // ---------------------------------------------------------------------------
  // Card renderer (wraps ImportPreviewCard with confidence + collection toggle)
  // ---------------------------------------------------------------------------

  const makeCardRenderer = (collection) => (item) => {
    const parsed = parsedItems.find(r => r.item.id === item.id);
    return (
      <CollectionToggleCard
        key={item.id}
        item={item}
        collection={collection}
        existingItems={data?.[collection] || []}
        selected={selectedIds.has(item.id)}
        onToggleSelect={() => toggleId(item.id)}
        onUpdate={updateItem}
        colorScheme="red"
        replaceMode={replaceIds.has(item.id)}
        onToggleReplace={() => toggleReplaceId(item.id)}
        confidence={parsed?.confidence}
        onToggleCollection={() => toggleItemCollection(item.id)}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Thumbnail label for each image
  // ---------------------------------------------------------------------------

  const getImageLabel = (key) => {
    if (sceneImageKeys.has(key)) return { text: 'Scene img', style: 'scene' };
    const detected = fileCollections.get(key);
    if (detected) return { text: COLLECTION_LABELS[detected] || detected, style: detected };
    if (parsing) return { text: 'Parsing\u2026', style: 'parsing' };
    return { text: 'Stat block', style: 'default' };
  };

  const labelStyles = {
    scene:        'bg-amber-900/90 text-amber-200 hover:bg-amber-800 border-t border-amber-700/50',
    adversaries:  'bg-red-900/90 text-red-200 hover:bg-red-800 border-t border-red-700/50',
    environments: 'bg-teal-900/90 text-teal-200 hover:bg-teal-800 border-t border-teal-700/50',
    parsing:      'bg-slate-800/90 text-slate-400 border-t border-slate-700/50',
    default:      'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border-t border-slate-700/50',
  };

  const borderStyles = {
    scene:        'border-amber-500/70',
    adversaries:  'border-red-500/60',
    environments: 'border-teal-500/60',
    parsing:      'border-slate-600',
    default:      'border-slate-700',
  };

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  const importLabel = createScene
    ? `Import Scene${selectedCount > 0 ? ` + ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}` : ''}`
    : `Import ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`;

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleImport}
        disabled={importing || totalImportCount === 0}
        className="px-5 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {importing
          ? <><Loader2 size={14} className="animate-spin" /> Importing&hellip;</>
          : importLabel}
      </button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const lightboxFile = lightboxKey ? files.find(f => f.key === lightboxKey) : null;

  return (
    <ImportModalShell title="Import Stat Blocks" onClose={onClose} footer={footer}>
      <div className="space-y-5">
        {/* Drop zone */}
        <div
          ref={dropZoneRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors select-none ${
            isDragging
              ? 'border-red-500 bg-red-950/20'
              : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
          }`}
        >
          <Upload size={28} className={isDragging ? 'text-red-400' : 'text-slate-500'} />
          <p className="text-slate-300 font-medium text-sm">
            Drop images here, click to browse, or paste with Ctrl/Cmd+V
          </p>
          <p className="text-slate-500 text-xs">
            PNG, JPG, WebP &middot; Stat block screenshots are auto-parsed
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Image thumbnails with role toggles */}
        {files.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-2.5">
              {files.map(({ previewUrl, key }, idx) => {
                const { text: labelText, style: labelStyle } = getImageLabel(key);
                const isSceneImg = sceneImageKeys.has(key);
                return (
                  <div
                    key={key}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${borderStyles[labelStyle]}`}
                    style={{ width: 88, height: 100 }}
                    onClick={() => setLightboxKey(key)}
                  >
                    <img src={previewUrl} alt="" className="w-full object-cover" style={{ height: 72 }} />
                    {/* Expand hint on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none" style={{ height: 72 }}>
                      <Maximize2 size={18} className="text-white/0 group-hover:text-white/80 transition-colors drop-shadow-lg" />
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                    {/* Role toggle — full-width bottom bar */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleImageRole(key); }}
                      className={`absolute bottom-0 inset-x-0 h-[28px] text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${labelStyles[labelStyle]}`}
                      title={isSceneImg
                        ? 'Click to parse as a stat block instead'
                        : 'Click to use as scene artwork instead'}
                    >
                      <ArrowLeftRight size={9} className="flex-shrink-0 opacity-60" />
                      {labelText}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="rounded-lg border border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                style={{ width: 88, height: 100 }}
                title="Add more images"
              >
                <Image size={20} />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Click image to enlarge &middot; Click label to change type
            </p>
          </div>
        )}

        {/* Text paste area */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            <FileText size={12} /> Paste stat block text (optional)
          </label>
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            rows={4}
            placeholder="Paste one or more stat block texts here (separate multiple blocks with blank lines)&hellip;"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
          />
        </div>

        {/* Parse error */}
        {parseError && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
            {parseError}
          </p>
        )}

        {/* Parsing indicator */}
        {parsing && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <Loader2 size={14} className="animate-spin" />
            Analyzing images&hellip;
          </div>
        )}

        {/* Parsed results */}
        {!parsing && parsedItems.length > 0 && (
          <div className="border-t border-slate-800 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Detected Items
            </h3>

            <ImportPreviewSection
              label="Adversaries"
              items={adversaries}
              collection="adversaries"
              existingItems={data?.adversaries || []}
              selectedIds={selectedIds}
              onToggleId={toggleId}
              onUpdateItem={updateItem}
              colorScheme="red"
              replaceIds={replaceIds}
              onToggleReplaceId={toggleReplaceId}
              renderCard={makeCardRenderer('adversaries')}
            />

            <ImportPreviewSection
              label="Environments"
              items={environments}
              collection="environments"
              existingItems={data?.environments || []}
              selectedIds={selectedIds}
              onToggleId={toggleId}
              onUpdateItem={updateItem}
              colorScheme="red"
              replaceIds={replaceIds}
              onToggleReplaceId={toggleReplaceId}
              renderCard={makeCardRenderer('environments')}
            />
          </div>
        )}

        {/* Scene builder */}
        {hasContent && (
          <div className="border-t border-slate-800 pt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createScene}
                onChange={e => setCreateScene(e.target.checked)}
                className="accent-amber-500"
              />
              <MapIcon size={14} className="text-amber-400" />
              <span className="text-sm font-medium text-slate-300">Create a Scene from imported items</span>
            </label>

            {createScene && (
              <div className="mt-3 space-y-3 ml-6">
                <input
                  type="text"
                  value={sceneName}
                  onChange={e => setSceneName(e.target.value)}
                  placeholder="Scene name&hellip;"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-amber-600"
                />
                <textarea
                  value={sceneDescription}
                  onChange={e => setSceneDescription(e.target.value)}
                  placeholder="Scene description (optional)&hellip;"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-amber-600 resize-none"
                />
                {sceneImageCount > 0 && (
                  <p className="text-xs text-amber-400/80">
                    {sceneImageCount} image{sceneImageCount !== 1 ? 's' : ''} marked as scene artwork
                  </p>
                )}
                {selectedCount > 0 && (
                  <p className="text-xs text-slate-500">
                    {selectedCount} detected item{selectedCount !== 1 ? 's' : ''} will be added to the scene
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {hasContent && (parsedItems.length > 0 || createScene) && (
          <ImportPreviewSummary summaryParts={summaryStr} />
        )}
      </div>

      {/* Lightbox overlay */}
      {lightboxFile && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxKey(null)}
        >
          <img
            src={lightboxFile.previewUrl}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxKey(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </ImportModalShell>
  );
}

// ---------------------------------------------------------------------------
// CollectionToggleCard — ImportPreviewCard wrapper with confidence badge
// and a button to switch between adversary / environment
// ---------------------------------------------------------------------------

function CollectionToggleCard({
  item,
  collection,
  existingItems,
  selected,
  onToggleSelect,
  onUpdate,
  colorScheme,
  replaceMode,
  onToggleReplace,
  confidence,
  onToggleCollection,
}) {
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const confColor =
    confidencePct == null ? '' :
    confidencePct >= 70 ? 'text-green-400' :
    confidencePct >= 40 ? 'text-yellow-400' :
    'text-red-400';
  const otherLabel = collection === 'adversaries' ? 'environment' : 'adversary';

  return (
    <div className="relative">
      <div className="absolute top-2.5 right-8 z-10 flex items-center gap-1.5">
        {confidencePct != null && (
          <span className={`text-[10px] font-mono leading-none ${confColor} bg-slate-900 border border-slate-700 rounded px-1 py-0.5`}>
            {confidencePct}%
          </span>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleCollection(); }}
          title={`Switch to ${otherLabel}`}
          className="text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-0.5 transition-colors leading-none"
        >
          <ArrowLeftRight size={9} className="flex-shrink-0" />
          {otherLabel}
        </button>
      </div>
      <ImportPreviewCard
        item={item}
        collection={collection}
        existingItems={existingItems}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onUpdate={onUpdate}
        colorScheme={colorScheme}
        replaceMode={replaceMode}
        onToggleReplace={onToggleReplace}
      />
    </div>
  );
}
