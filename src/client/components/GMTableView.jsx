import { useMemo, useState } from 'react';
import { Zap, Trash2, Pencil, LayoutDashboard, Monitor } from 'lucide-react';
import { parseFeatureCategory, parseCountdownValue } from '../lib/helpers.js';
import { FeatureDescription } from './FeatureDescription.jsx';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';
import { EditChoiceDialog } from './modals/EditChoiceDialog.jsx';
import { EditFormModal } from './modals/EditFormModal.jsx';

function extractIframeSrc(embedCode) {
  try {
    const match = embedCode.match(/\bsrc=["']([^"']+)["']/i);
    if (match && match[1].startsWith('https://')) return match[1];
  } catch (_) {}
  return null;
}

function WhiteboardTab({ whiteboardEmbed, setWhiteboardEmbed, hidden }) {
  const [draft, setDraft] = useState(whiteboardEmbed);
  const iframeSrc = extractIframeSrc(whiteboardEmbed);

  const handleSave = () => {
    setWhiteboardEmbed(draft.trim());
  };

  return (
    <div className={`flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950 p-6 gap-4${hidden ? ' hidden' : ''}`}>
      <div className="flex flex-col gap-2 shrink-0">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zoom Whiteboard Embed Code</label>
        <div className="flex gap-2 items-start">
          <textarea
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500 resize-none h-20"
            placeholder='Paste your <iframe ...> embed code here'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Save
          </button>
        </div>
      </div>

      {iframeSrc ? (
        <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
          <iframe
            src={iframeSrc}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
            title="Zoom Whiteboard"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
          <Monitor size={32} className="opacity-40" />
          <p className="text-sm">Paste your Zoom whiteboard embed code above to display it here.</p>
        </div>
      )}
    </div>
  );
}

// Strip runtime tracking fields to get the base item data for form editing.
function getItemData(element) {
  const { instanceId, elementType, currentHp, currentStress, conditions, groupName, ...rest } = element;
  return rest;
}

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, updateActiveElementsBaseData, data, saveItem, addToTable, startScene, whiteboardEmbed, setWhiteboardEmbed, gmTab, navigate, featureCountdowns = {}, updateCountdown }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  // editState: null | { step: 'choice', baseElement, instances, collection }
  //                  | { step: 'form', item, collection, mode, baseElement, instances }
  const [editState, setEditState] = useState(null);

  const handleEditClick = (instances, baseElement, collection) => {
    const canEditOriginal = !baseElement._source || baseElement._source === 'own';
    if (!canEditOriginal) {
      setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
    } else {
      setEditState({ step: 'choice', instances, baseElement, collection });
    }
  };

  const handleChoiceEditCopy = () => {
    const { instances, baseElement, collection } = editState;
    setEditState({ step: 'form', item: getItemData(baseElement), collection, mode: 'copy', instances, baseElement });
  };

  const handleChoiceEditOriginal = () => {
    const { baseElement, collection } = editState;
    const libraryItem = data[collection]?.find(i => i.id === baseElement.id) || getItemData(baseElement);
    setEditState({ ...editState, step: 'form', item: libraryItem, mode: 'original' });
  };

  const handleEditFormSave = async (editedData) => {
    const { mode, collection, baseElement } = editState;
    setEditState(null);
    const itemWithId = { ...editedData, id: baseElement.id };
    if (mode === 'copy') {
      updateActiveElementsBaseData(
        el => el.id === baseElement.id && (el.groupName || '') === (baseElement.groupName || ''),
        itemWithId
      );
    } else {
      await saveItem(collection, itemWithId);
      updateActiveElementsBaseData(el => el.id === itemWithId.id, itemWithId);
    }
  };
  // Group adversaries of the same type (same id + groupName) into consolidated entries.
  // Environments remain as individual entries.
  const consolidatedElements = useMemo(() => {
    const result = [];
    const seenAdvKeys = {}; // key -> index in result

    activeElements.forEach(el => {
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
  }, [activeElements]);

  // Deduplicate actions by adversary id — same type only appears once in the board.
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Passives': [], 'Reactions': [], 'Fear Actions': [], 'Actions': [] };
    const seenAdvIds = new Set();

    activeElements.forEach(element => {
      if (element.elementType === 'adversary') {
        if (seenAdvIds.has(element.id)) return;
        seenAdvIds.add(element.id);
      }

      const cardKey = element.elementType === 'adversary'
        ? `${element.id}|${element.groupName || ''}`
        : element.instanceId;

      if (element.attack && element.attack.name) {
        menu['Actions'].push({
          id: `${element.instanceId}-attack`,
          name: element.attack.name,
          type: 'action',
          description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
          sourceName: element.name,
          cardKey,
          featureKey: 'attack',
        });
      }

      element.features?.forEach((feature, featureIdx) => {
        const category = parseFeatureCategory(feature);
        menu[category].push({
          ...feature,
          sourceName: element.name,
          cardKey,
          featureKey: `feat-${featureIdx}`,
        });
      });
    });
    return menu;
  }, [activeElements]);

  const removeGroup = (instances) => {
    instances.forEach(inst => removeActiveElement(inst.instanceId));
  };

  const tabBase = 'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors';
  const tabActive = 'border-red-500 text-white';
  const tabInactive = 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Consolidated Actions (always visible) */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0">
        <div className="p-4 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={18} className="text-yellow-500" /> Actions Board
          </h2>
        </div>

        <div className="p-4 space-y-6">
          {Object.entries(consolidatedMenu).map(([category, features]) => {
            if (features.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">{category}</h3>
                <div className="space-y-2">
                  {features.map((feature, idx) => {
                    const countdownInit = parseCountdownValue(feature.description);
                    const cdKey = `${feature.cardKey}|${feature.featureKey}`;
                    const countdownVal = featureCountdowns[cdKey] ?? countdownInit;
                    return (
                      <div
                        key={`${feature.id}-${idx}`}
                        onMouseEnter={() => setHoveredFeature({ cardKey: feature.cardKey, featureKey: feature.featureKey })}
                        onMouseLeave={() => setHoveredFeature(null)}
                        className="w-full text-left bg-slate-800/50 hover:bg-slate-800 p-3 rounded border border-slate-700 hover:border-r-yellow-500 transition-all group cursor-default"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-slate-200 group-hover:text-white text-sm">{feature.name}</span>
                          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{feature.sourceName}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2"><FeatureDescription description={feature.description} /></p>
                        {countdownInit !== null && (
                          <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-slate-400">Countdown</span>
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => updateCountdown(feature.cardKey, feature.featureKey, Math.max(0, countdownVal - 1))}
                                className="w-5 h-5 rounded bg-slate-700 hover:bg-red-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
                              >−</button>
                              <span className="min-w-[1.5rem] text-center font-bold text-yellow-400 text-sm tabular-nums">{countdownVal}</span>
                              <button
                                onClick={() => updateCountdown(feature.cardKey, feature.featureKey, countdownVal + 1)}
                                className="w-5 h-5 rounded bg-slate-700 hover:bg-green-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
                              >+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {activeElements.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No active elements.<br />Start a scene to populate actions.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Tab bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0">
          <button
            className={`${tabBase} ${gmTab === 'table' ? tabActive : tabInactive}`}
            onClick={() => navigate('/gm-table/table')}
          >
            <Monitor size={16} /> Behind the Screen
          </button>
          <button
            className={`${tabBase} ${gmTab === 'whiteboard' ? tabActive : tabInactive}`}
            onClick={() => navigate('/gm-table/whiteboard')}
          >
            <LayoutDashboard size={16} /> Game Table
          </button>
        </div>
        <WhiteboardTab whiteboardEmbed={whiteboardEmbed} setWhiteboardEmbed={setWhiteboardEmbed} hidden={gmTab !== 'whiteboard'} />
        <div className={`flex-1 bg-slate-950 p-6 overflow-y-auto relative${gmTab === 'whiteboard' ? ' hidden' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">The Table</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const adv = data.adversaries.find(a => a.id === e.target.value);
                  if (adv) addToTable(adv, 'adversaries');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Adversary...</option>
              {data.adversaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const env = data.environments.find(e2 => e2.id === e.target.value);
                  if (env) addToTable(env, 'environments');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Environment...</option>
              {data.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const group = data.groups.find(g => g.id === e.target.value);
                  if (group) addToTable(group, 'groups');
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Add Group...</option>
              {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if (e.target.value) {
                  const scene = data.scenes.find(s => s.id === e.target.value);
                  if (scene) startScene(scene);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Start Scene...</option>
              {data.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="columns-1 xl:columns-2 2xl:columns-3 gap-4 space-y-4">
          {consolidatedElements.map((item) => {
            if (item.kind === 'environment') {
              const element = item.element;
              const envCardKey = element.instanceId;
              return (
                <div
                  key={element.instanceId}
                  className="break-inside-avoid bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden"
                >
                  {element.imageUrl && (
                    <div className="w-full h-40 overflow-hidden bg-slate-950">
                      <img src={element.imageUrl} alt={element.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditClick([element], element, 'environments')}
                        className="text-slate-500 hover:text-blue-400"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => removeActiveElement(element.instanceId)} className="text-slate-500 hover:text-red-500" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-1 pr-14">
                      <h3 className="text-xl font-bold text-white">{element.name}</h3>
                    </div>

                    <EnvironmentCardContent
                      element={element}
                      hoveredFeature={hoveredFeature}
                      cardKey={envCardKey}
                      featureCountdowns={featureCountdowns}
                      updateCountdown={updateCountdown}
                    />
                  </div>
                </div>
              );
            }

            // adversary-group
            const { baseElement: el, instances } = item;
            const count = instances.length;
            const advCardKey = `${el.id}|${el.groupName || ''}`;

            return (
              <div
                key={advCardKey}
                className="break-inside-avoid bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl shadow-lg transition-all duration-300 relative overflow-hidden"
              >
                {el.imageUrl && (
                  <div className="w-full h-40 overflow-hidden bg-slate-950">
                    <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  </div>
                )}

                <div className="p-5">
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditClick(instances, el, 'adversaries')}
                      className="text-slate-500 hover:text-blue-400"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => removeGroup(instances)} className="text-slate-500 hover:text-red-500" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-1 pr-14">
                    <h3 className="text-xl font-bold text-white">
                      {el.name}
                      {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                    </h3>
                    {el.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{el.groupName}</span>}
                  </div>

                  <AdversaryCardContent
                    element={el}
                    hoveredFeature={hoveredFeature}
                    cardKey={advCardKey}
                    count={count}
                    instances={instances}
                    updateFn={updateActiveElement}
                    showInstanceRemove={true}
                    removeInstanceFn={removeActiveElement}
                    featureCountdowns={featureCountdowns}
                    updateCountdown={updateCountdown}
                  />
                </div>
              </div>
            );
          })}

          {activeElements.length === 0 && (
            <div className="w-full h-64 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              The table is empty. Select a scene above to start.
            </div>
          )}
        </div>
      </div>
    </div>

    {editState?.step === 'choice' && (
      <EditChoiceDialog
        itemName={editState.baseElement.name}
        contextLabel="Table"
        canEditOriginal={!editState.baseElement._source || editState.baseElement._source === 'own'}
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
        onSave={handleEditFormSave}
        onClose={() => setEditState(null)}
      />
    )}
    </div>
  );
}
