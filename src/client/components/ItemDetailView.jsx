import { useState, useMemo, useEffect } from 'react';
import { X, Copy, Edit, Pencil, Trash2, BookCopy, Globe, Lock } from 'lucide-react';
import { generateRolzExport } from '../lib/rolz-export.js';
import { generateId } from '../lib/helpers.js';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { EditFormModal } from './modals/EditFormModal.jsx';

const SOURCE_BADGE = {
  srd: { label: 'SRD', className: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
  public: { label: 'Public', className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
};

/**
 * Builds the flat list of adversary/environment elements from a scene or group item.
 * Each element has origin metadata so the edit-copy flow can update the right entry.
 * Handles both ID references and inline owned copies (ref.data).
 */
function buildElements(item, tab, data) {
  const elements = [];

  const pushAdversary = (adv, groupName, originMeta) => {
    elements.push({
      ...adv,
      instanceId: generateId(),
      elementType: 'adversary',
      currentHp: adv.hp_max || 0,
      currentStress: 0,
      conditions: '',
      ...(groupName ? { groupName } : {}),
      ...originMeta,
    });
  };

  const pushEnvironment = (env, originMeta) => {
    elements.push({ ...env, instanceId: generateId(), elementType: 'environment', ...originMeta });
  };

  if (tab === 'groups') {
    (item.adversaries || []).forEach((advRef, refIdx) => {
      if (advRef.data) {
        const adv = { id: advRef.data.id || generateId(), ...advRef.data };
        for (let i = 0; i < (advRef.count || 1); i++) {
          pushAdversary(adv, null, {
            _origin: 'direct-adv', _originRefIndex: refIdx,
            _count: advRef.count || 1, _isOwnedCopy: true, _collection: 'adversaries',
          });
        }
      } else {
        const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
        if (adv) {
          for (let i = 0; i < (advRef.count || 1); i++) {
            pushAdversary(adv, null, {
              _origin: 'direct-adv', _originRefIndex: refIdx,
              _originAdvId: advRef.adversaryId, _count: advRef.count || 1,
              _isOwnedCopy: false, _collection: 'adversaries', _source: adv._source,
            });
          }
        }
      }
    });
  } else if (tab === 'scenes') {
    const groupOverrides = item.groupOverrides || [];

    (item.environments || []).forEach((envEntry, refIdx) => {
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
      if (advRef.data) {
        const adv = { id: advRef.data.id || generateId(), ...advRef.data };
        for (let i = 0; i < (advRef.count || 1); i++) {
          pushAdversary(adv, null, {
            _origin: 'direct-adv', _originRefIndex: refIdx,
            _count: advRef.count || 1, _isOwnedCopy: true, _collection: 'adversaries',
          });
        }
      } else {
        const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
        if (adv) {
          for (let i = 0; i < (advRef.count || 1); i++) {
            pushAdversary(adv, null, {
              _origin: 'direct-adv', _originRefIndex: refIdx,
              _originAdvId: advRef.adversaryId, _count: advRef.count || 1,
              _isOwnedCopy: false, _collection: 'adversaries', _source: adv._source,
            });
          }
        }
      }
    });

    (item.groups || []).forEach(groupId => {
      const group = data.groups?.find(g => g.id === groupId);
      if (group) {
        (group.adversaries || []).forEach((advRef, refIdx) => {
          const isOverridden = groupOverrides.some(
            ov => ov.groupId === groupId && ov.adversaryId === advRef.adversaryId
          );
          if (isOverridden) return;
          if (advRef.data) {
            const adv = { id: advRef.data.id || generateId(), ...advRef.data };
            for (let i = 0; i < (advRef.count || 1); i++) {
              // Group-owned copy: can only edit via the group, not as a scene override
              pushAdversary(adv, group.name, {
                _origin: 'group', _originGroupId: groupId,
                _originRefIndex: refIdx, _count: advRef.count || 1,
                _isOwnedCopy: true, _isGroupOwnedCopy: true, _collection: 'adversaries',
              });
            }
          } else {
            const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
            if (adv) {
              for (let i = 0; i < (advRef.count || 1); i++) {
                pushAdversary(adv, group.name, {
                  _origin: 'group', _originGroupId: groupId,
                  _originAdvId: advRef.adversaryId, _originRefIndex: refIdx,
                  _count: advRef.count || 1, _isOwnedCopy: false,
                  _collection: 'adversaries', _source: adv._source,
                });
              }
            }
          }
        });
      }
    });
  }

  return elements;
}

// Strip origin/runtime metadata before passing element data to a form.
function getElementItemData(element) {
  const {
    instanceId, elementType, currentHp, currentStress, conditions, groupName,
    _origin, _originRefIndex, _originGroupId, _originAdvId, _originEnvId,
    _count, _isOwnedCopy, _isGroupOwnedCopy, _collection, _source, _owner,
    ...rest
  } = element;
  return rest;
}

function ExpandedTablePreview({ item, tab, data, onSaveElement, isOwn }) {
  const [elements, setElements] = useState(() => buildElements(item, tab, data));
  const [hoveredFeature, setHoveredFeature] = useState(null);
  // editState: null | { step: 'choice', element } | { step: 'form', item, collection, mode, element }
  const [editState, setEditState] = useState(null);

  // Reset elements when item or data changes (e.g. after saving a library original).
  useEffect(() => {
    setElements(buildElements(item, tab, data));
  }, [item, data]);

  const consolidated = useMemo(() => {
    const result = [];
    const seenAdvKeys = {};
    elements.forEach(el => {
      if (el.elementType !== 'adversary') {
        result.push({ kind: 'environment', element: el });
      } else {
        const key = `${el.id}|${el.groupName || ''}`;
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
    // Group-owned copies can only be edited in the group, not from the scene view.
    if (element._isGroupOwnedCopy) return;
    if (element._isOwnedCopy) {
      // Already a local copy — go straight to the form.
      setEditState({ step: 'form', item: getElementItemData(element), collection: element._collection, mode: 'copy', element });
    } else if (!element._source || element._source === 'own') {
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
    const libraryItem = data[element._collection]?.find(i => i.id === element.id) || getElementItemData(element);
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
        No elements in this {tab === 'groups' ? 'group' : 'scene'}.
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
                  <div className="w-full h-32 overflow-hidden">
                    <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  </div>
                )}
                <div className="p-4">
                  {showEditBtn && (
                    <button
                      onClick={() => handleEditClick(el)}
                      className="absolute top-3 right-3 text-slate-600 hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <h4 className="text-lg font-bold text-white mb-0.5 pr-6">{el.name}</h4>
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
          const advCardKey = `${el.id}|${el.groupName || ''}`;
          const canEditEl = showEditBtn && !el._isGroupOwnedCopy;

          return (
            <div key={advCardKey} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
              {el.imageUrl && (
                <div className="w-full h-32 overflow-hidden">
                  <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </div>
              )}
              <div className="p-4">
                {canEditEl && (
                  <button
                    onClick={() => handleEditClick(el)}
                    className="absolute top-3 right-3 text-slate-600 hover:text-blue-400 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <div className="flex items-center gap-2 mb-0.5 pr-6">
                  <h4 className="text-lg font-bold text-white">
                    {el.name}
                    {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                  </h4>
                  {el.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{el.groupName}</span>}
                </div>
                {el._isOwnedCopy && (
                  <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/50 px-1.5 py-0.5 rounded mb-1 inline-block">local copy</span>
                )}
                <AdversaryCardContent
                  element={el}
                  hoveredFeature={hoveredFeature}
                  cardKey={advCardKey}
                  count={count}
                  instances={instances}
                  updateFn={updateElement}
                  showInstanceRemove={false}
                />
              </div>
            </div>
          );
        })}
      </div>

      {editState?.step === 'choice' && (
        <EditChoiceDialog
          itemName={editState.element.name}
          contextLabel={tab === 'groups' ? 'Group' : 'Scene'}
          canEditOriginal={!editState.element._source || editState.element._source === 'own'}
          onEditCopy={handleChoiceEditCopy}
          onEditOriginal={handleChoiceEditOriginal}
          onClose={() => setEditState(null)}
        />
      )}
      {editState?.step === 'form' && (
        <EditFormModal
          item={editState.item}
          collection={editState.collection}
          data={data}
          onSave={handleFormSave}
          onClose={() => setEditState(null)}
        />
      )}
    </>
  );
}

export function ItemDetailView({ item, tab, data, onEdit, onDelete, onClone, onClose, onSavePublic, onSaveElement }) {
  const [copied, setCopied] = useState(false);
  const [cloningStatus, setCloningStatus] = useState('');
  const [publicSaving, setPublicSaving] = useState(false);

  const isOwn = !item._source || item._source === 'own';
  const badge = SOURCE_BADGE[item._source];

  const handleCopyRolz = async () => {
    try {
      const markdown = generateRolzExport(item, tab, data || {});
      try {
        await navigator.clipboard.writeText(markdown);
      } catch (clipErr) {
        const ta = document.createElement('textarea');
        ta.value = markdown;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Rolz export failed:', err);
    }
  };

  const handleClone = async () => {
    setCloningStatus('Cloning...');
    try {
      await onClone();
      setCloningStatus('Cloned!');
      setTimeout(() => setCloningStatus(''), 2000);
    } catch (err) {
      console.error('Clone failed:', err);
      setCloningStatus('Error');
      setTimeout(() => setCloningStatus(''), 2000);
    }
  };

  const handleTogglePublic = async () => {
    if (!onSavePublic) return;
    setPublicSaving(true);
    try {
      await onSavePublic(!item.is_public);
    } catch (err) {
      console.error('Toggle public failed:', err);
    } finally {
      setPublicSaving(false);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg shadow-xl relative overflow-hidden ${(tab === 'groups' || tab === 'scenes') ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={20} /></button>

      {item.imageUrl && (
        <div className="w-full h-56 overflow-hidden bg-slate-950">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-90" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}

      <div className="p-6">
        <div className="mb-4 pr-8">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-3xl font-bold text-white">{item.name}</h2>
            {badge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          {(tab === 'groups' || tab === 'scenes' || tab === 'adventures') && (
            <>
              <div className="text-slate-400 uppercase tracking-wider text-sm font-medium mb-2">
                {tab === 'groups' && 'Group'}
                {tab === 'scenes' && 'Scene'}
                {tab === 'adventures' && 'Adventure'}
              </div>
              {item.description && (
                <div className="text-slate-300 italic whitespace-pre-wrap text-sm">{item.description}</div>
              )}
            </>
          )}
        </div>

        {(tab === 'groups' || tab === 'scenes') && data && (
          <ExpandedTablePreview item={item} tab={tab} data={data} onSaveElement={onSaveElement} isOwn={isOwn} />
        )}

        {tab === 'adversaries' && (
          <AdversaryCardContent element={item} hoveredFeature={null} cardKey={item.id} />
        )}

        {tab === 'environments' && (
          <EnvironmentCardContent element={item} hoveredFeature={null} cardKey={item.id} />
        )}

        <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyRolz}
              className={`px-4 py-2 rounded font-medium flex items-center gap-2 text-sm transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
            >
              <Copy size={15} /> {copied ? 'Copied!' : 'Copy Rolz'}
            </button>

            {onClone && (
              <button
                onClick={handleClone}
                disabled={!!cloningStatus}
                className="px-4 py-2 rounded font-medium flex items-center gap-2 text-sm bg-violet-700 hover:bg-violet-600 text-white transition-colors disabled:opacity-60"
              >
                <BookCopy size={15} /> {cloningStatus || 'Clone to My Library'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isOwn && onSavePublic && (
              <button
                onClick={handleTogglePublic}
                disabled={publicSaving}
                title={item.is_public ? 'Make private' : 'Make public'}
                className={`px-3 py-2 rounded font-medium flex items-center gap-2 text-sm transition-colors disabled:opacity-60 ${
                  item.is_public
                    ? 'bg-blue-800 hover:bg-blue-700 text-blue-200'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.is_public ? <Globe size={15} /> : <Lock size={15} />}
                {item.is_public ? 'Public' : 'Private'}
              </button>
            )}

            {isOwn && onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2 bg-slate-700 hover:bg-red-800 text-slate-300 hover:text-white rounded font-medium flex items-center gap-2 text-sm transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}

            {isOwn && onEdit && (
              <button onClick={onEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
                <Edit size={16} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
