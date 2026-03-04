import { useState, useMemo, useEffect, useRef } from 'react';
import { Pencil, X } from 'lucide-react';
import { generateId } from '../lib/helpers.js';
import { resolveItems } from '../lib/api.js';
import { getUnscaledAdversary } from '../lib/adversary-defaults.js';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { isOwnItem } from '../lib/constants.js';

/**
 * Builds the flat list of adversary/environment elements from a scene item.
 * Each element has origin metadata so the edit-copy flow can update the right entry.
 * Handles both ID references and inline owned copies (ref.data).
 * visited prevents infinite recursion from circular scene references.
 */
function buildElements(item, tab, data, visited = new Set(), depth = 0) {
  if (tab !== 'scenes') return [];
  if (visited.has(item.id) || depth > 10) return [];
  visited.add(item.id);

  const elements = [];

  const pushAdversary = (adv, originMeta) => {
    elements.push({
      ...adv,
      instanceId: generateId(),
      elementType: 'adversary',
      currentHp: adv.hp_max || 0,
      currentStress: 0,
      conditions: '',
      ...originMeta,
    });
  };

  const pushEnvironment = (env, originMeta) => {
    elements.push({ ...env, instanceId: generateId(), elementType: 'environment', ...originMeta });
  };

  (item.environments || []).forEach((envEntry, refIdx) => {
    if (envEntry == null) return;
    if (typeof envEntry === 'object' && envEntry.data) {
      const env = { id: envEntry.data.id || generateId(), ...envEntry.data };
      pushEnvironment(env, {
        _origin: 'direct-env', _originRefIndex: refIdx,
        _isOwnedCopy: true, _collection: 'environments',
      });
    } else {
      const env = data.environments?.find(e => e.id === envEntry);
      if (env) {
        pushEnvironment(env, {
          _origin: 'direct-env', _originRefIndex: refIdx,
          _originEnvId: envEntry, _isOwnedCopy: false,
          _collection: 'environments', _source: env._source,
        });
      }
    }
  });

  (item.adversaries || []).forEach((advRef, refIdx) => {
    if (advRef == null) return;
    if (advRef.data) {
      const adv = { id: advRef.data.id || generateId(), ...advRef.data };
      for (let i = 0; i < (advRef.count || 1); i++) {
        pushAdversary(adv, {
          _origin: 'direct-adv', _originRefIndex: refIdx,
          _count: advRef.count || 1, _isOwnedCopy: true, _collection: 'adversaries',
        });
      }
    } else {
      const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
      if (adv) {
        for (let i = 0; i < (advRef.count || 1); i++) {
          pushAdversary(adv, {
            _origin: 'direct-adv', _originRefIndex: refIdx,
            _originAdvId: advRef.adversaryId, _count: advRef.count || 1,
            _isOwnedCopy: false, _collection: 'adversaries', _source: adv._source,
          });
        }
      }
    }
  });

  (item.scenes || []).forEach(nestedId => {
    const nested = data.scenes?.find(s => s.id === nestedId);
    if (nested) {
      elements.push(...buildElements(nested, 'scenes', data, visited, depth + 1));
    }
  });

  return elements;
}

// Strip origin/runtime metadata before passing element data to a form.
function getElementItemData(element) {
  const {
    instanceId, elementType, currentHp, currentStress, conditions,
    _origin, _originRefIndex, _originAdvId, _originEnvId,
    _count, _isOwnedCopy, _collection, _source, _owner,
    ...rest
  } = element;
  return rest;
}

/**
 * Collect adversary/environment IDs referenced by a scene (and nested scenes)
 * that are missing from the current `data` object so they can be resolved from the API.
 * visited prevents infinite recursion from circular scene references.
 */
function collectMissingRefs(item, tab, data, visited = new Set()) {
  if (tab !== 'scenes') return null;
  if (visited.has(item.id)) return null;
  visited.add(item.id);

  const missingAdv = [];
  const missingEnv = [];
  const advSet = new Set((data.adversaries || []).map(a => a.id));
  const envSet = new Set((data.environments || []).map(e => e.id));

  for (const envEntry of (item.environments || [])) {
    if (typeof envEntry === 'string' && !envSet.has(envEntry)) missingEnv.push(envEntry);
  }
  for (const ref of (item.adversaries || [])) {
    if (ref == null) continue;
    if (!ref.data && ref.adversaryId && !advSet.has(ref.adversaryId)) missingAdv.push(ref.adversaryId);
  }
  for (const nestedId of (item.scenes || [])) {
    const nested = data.scenes?.find(s => s.id === nestedId);
    if (nested) {
      const sub = collectMissingRefs(nested, 'scenes', data, visited);
      if (sub) {
        (sub.adversaries || []).forEach(id => missingAdv.push(id));
        (sub.environments || []).forEach(id => missingEnv.push(id));
      }
    }
  }

  const toResolve = {};
  if (missingAdv.length) toResolve.adversaries = [...new Set(missingAdv)];
  if (missingEnv.length) toResolve.environments = [...new Set(missingEnv)];
  return Object.keys(toResolve).length ? toResolve : null;
}

export function ExpandedTablePreview({ item, tab, data, onSaveElement, isOwn, damageBoost }) {
  const [resolvedData, setResolvedData] = useState(data);
  const [elements, setElements] = useState(() => buildElements(item, tab, data));
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [editState, setEditState] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [scaledToggleState, setScaledToggleState] = useState({});
  const resolvedIdsRef = useRef(new Set());
  const resolvedDataRef = useRef(resolvedData);
  resolvedDataRef.current = resolvedData;

  // When data changes from parent, merge with any previously resolved items.
  useEffect(() => {
    setResolvedData(prev => {
      const merged = { ...data };
      for (const col of ['adversaries', 'environments']) {
        const existing = new Set((data[col] || []).map(i => i.id));
        const extras = (prev[col] || []).filter(i => !existing.has(i.id));
        if (extras.length) merged[col] = [...(data[col] || []), ...extras];
      }
      return merged;
    });
  }, [data]);

  // Resolve missing references from the API on mount / when item changes.
  // Uses resolvedDataRef (not resolvedData) to avoid the data-merge effect
  // cancelling in-flight API calls via the cleanup function.
  useEffect(() => {
    const currentResolved = resolvedDataRef.current;
    const missing = collectMissingRefs(item, tab, currentResolved);
    if (!missing) return;
    // Don't re-fetch IDs we already tried.
    const toFetch = {};
    for (const [col, ids] of Object.entries(missing)) {
      const newIds = ids.filter(id => !resolvedIdsRef.current.has(id));
      if (newIds.length) toFetch[col] = newIds;
    }
    if (!Object.keys(toFetch).length) return;
    for (const ids of Object.values(toFetch)) ids.forEach(id => resolvedIdsRef.current.add(id));

    let cancelled = false;
    resolveItems(toFetch).then(resolved => {
      if (cancelled) return;
      setResolvedData(prev => {
        const next = { ...prev };
        for (const [col, items] of Object.entries(resolved)) {
          if (!Array.isArray(items) || !items.length) continue;
          const existing = new Set((prev[col] || []).map(i => i.id));
          const newItems = items.filter(i => !existing.has(i.id));
          if (newItems.length) next[col] = [...(prev[col] || []), ...newItems];
        }
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [item, tab]);

  // Rebuild elements whenever item or resolved data changes.
  useEffect(() => {
    setElements(buildElements(item, tab, resolvedData));
  }, [item, resolvedData]);

  const consolidated = useMemo(() => {
    const result = [];
    const seenAdvKeys = {};
    elements.forEach(el => {
      if (el.elementType !== 'adversary') {
        result.push({ kind: 'environment', element: el });
      } else {
        const key = el.id;
        if (seenAdvKeys[key] === undefined) {
          seenAdvKeys[key] = result.length;
          result.push({ kind: 'adversary-group', baseElement: el, instances: [el] });
        } else {
          result[seenAdvKeys[key]].instances.push(el);
        }
      }
    });
    return result;
  }, [elements]);

  const updateElement = (instanceId, updates) => {
    setElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
  };

  const handleEditClick = (element) => {
    if (!onSaveElement) return;
    if (element._isOwnedCopy) {
      // Already a local copy — go straight to the form.
      setEditState({ step: 'form', item: getElementItemData(element), collection: element._collection, mode: 'copy', element });
    } else if (isOwnItem(element)) {
      setEditState({ step: 'choice', element });
    } else {
      // SRD or public — forced copy.
      setEditState({ step: 'form', item: getElementItemData(element), collection: element._collection, mode: 'copy', element });
    }
  };

  const handleChoiceEditCopy = () => {
    const { element } = editState;
    setEditState({ step: 'form', item: getElementItemData(element), collection: element._collection, mode: 'copy', element });
  };

  const handleChoiceEditOriginal = () => {
    const { element } = editState;
    const libraryItem = resolvedData[element._collection]?.find(i => i.id === element.id) || getElementItemData(element);
    setEditState({ ...editState, step: 'form', item: libraryItem, mode: 'original' });
  };

  const handleFormSave = async (editedData) => {
    const { mode, element } = editState;
    setEditState(null);
    await onSaveElement(element, { ...editedData, id: element.id }, mode);
  };

  if (elements.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-6 border border-dashed border-slate-800 rounded-lg mt-4">
        No elements in this scene.
      </div>
    );
  }

  const showEditBtn = isOwn && !!onSaveElement;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        {consolidated.map(entry => {
          if (entry.kind === 'environment') {
            const el = entry.element;
            const cardKey = el.instanceId;
            return (
              <div key={el.instanceId} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
                {el.imageUrl && (
                  <div
                    className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer"
                    onClick={() => setLightboxUrl(el.imageUrl)}
                  >
                    <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  </div>
                )}
                {showEditBtn && (
                  <button
                    onClick={() => handleEditClick(el)}
                    className={`absolute top-2 right-2 z-10 text-slate-600 hover:text-blue-400 transition-colors ${el.imageUrl ? 'bg-slate-950/80 rounded p-0.5' : ''}`}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <div className="p-4">
                  <h4 className={`text-lg font-bold text-white mb-0.5 ${el.imageUrl ? 'pr-20' : 'pr-6'}`}>{el.name}</h4>
                  {el._isOwnedCopy && (
                    <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/50 px-1.5 py-0.5 rounded mb-1 inline-block">local copy</span>
                  )}
                  <EnvironmentCardContent element={el} hoveredFeature={hoveredFeature} cardKey={cardKey} />
                </div>
              </div>
            );
          }

          const { baseElement: el, instances } = entry;
          const count = instances.length;
          const advCardKey = el.id;
          const canEditEl = showEditBtn;
          const showScaled = scaledToggleState[el.id] ?? true;
          const displayEl = el._scaledFromTier != null && !showScaled ? getUnscaledAdversary(el) : el;
          const scaledMeta = el._scaledFromTier != null ? { fromTier: el._scaledFromTier, showScaled } : null;

          return (
            <div key={advCardKey} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
              {el.imageUrl && (
                <div
                  className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer"
                  onClick={() => setLightboxUrl(el.imageUrl)}
                >
                  <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </div>
              )}
              {canEditEl && (
                <button
                  onClick={() => handleEditClick(el)}
                  className={`absolute top-2 right-2 z-10 text-slate-600 hover:text-blue-400 transition-colors ${el.imageUrl ? 'bg-slate-950/80 rounded p-0.5' : ''}`}
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
              )}
              <div className="p-4">
                <div className={`flex items-center gap-2 mb-0.5 ${el.imageUrl ? 'pr-20' : 'pr-6'}`}>
                  <h4 className="text-lg font-bold text-white">
                    {displayEl.name}
                    {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                  </h4>
                </div>
                {el._isOwnedCopy && (
                  <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/50 px-1.5 py-0.5 rounded mb-1 inline-block">local copy</span>
                )}
                <AdversaryCardContent
                  element={displayEl}
                  hoveredFeature={hoveredFeature}
                  cardKey={advCardKey}
                  count={count}
                  instances={instances}
                  updateFn={updateElement}
                  showInstanceRemove={false}
                  damageBoost={damageBoost}
                  scaledMeta={scaledMeta}
                  onScaledToggle={() => setScaledToggleState(prev => ({ ...prev, [el.id]: !(prev[el.id] ?? true) }))}
                />
              </div>
            </div>
          );
        })}
      </div>

      {editState?.step === 'choice' && (
        <EditChoiceDialog
          itemName={editState.element.name}
          contextLabel="Scene"
          canEditOriginal={isOwnItem(editState.element)}
          onEditCopy={handleChoiceEditCopy}
          onEditOriginal={handleChoiceEditOriginal}
          onClose={() => setEditState(null)}
        />
      )}
      {editState?.step === 'form' && (
        <ItemDetailModal
          item={editState.item}
          collection={editState.collection}
          data={resolvedData}
          editable={true}
          onSave={async (editedData) => {
            if (onSaveElement) {
              await onSaveElement(editState.element, { ...editedData, id: editState.element.id }, editState.mode);
            }
          }}
          onClose={() => setEditState(null)}
        />
      )}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged image"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

