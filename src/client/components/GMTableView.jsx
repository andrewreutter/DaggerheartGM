import { useMemo, useState } from 'react';
import { Zap, Heart, AlertCircle, Trash2, X } from 'lucide-react';
import { parseFeatureCategory } from '../lib/helpers.js';

export function GMTableView({ activeElements, updateActiveElement, removeActiveElement, data, addToTable, startScene }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
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

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Consolidated Actions */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
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
                  {features.map((feature, idx) => (
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
                      <p className="text-xs text-slate-400 line-clamp-2">{feature.description}</p>
                    </div>
                  ))}
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

      {/* Right Column: The Table */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto relative">
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
                    <button onClick={() => removeActiveElement(element.instanceId)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>

                    <div className="flex items-center gap-2 mb-1 pr-8">
                      <h3 className="text-xl font-bold text-white">{element.name}</h3>
                    </div>

                    <div className="text-sm text-slate-400 mb-2 capitalize">
                      Tier {element.tier || 0} {element.type} Environment
                    </div>

                    {element.description && (
                      <div className="text-sm italic text-slate-300 mb-4 whitespace-pre-wrap">{element.description}</div>
                    )}

                    {element.features && element.features.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h4>
                        {element.features.map((feat, featIdx) => (
                          <div
                            key={feat.id ?? featIdx}
                            className={`text-sm pl-2 border-l-2 transition-colors ${
                              hoveredFeature?.cardKey === envCardKey && hoveredFeature?.featureKey === `feat-${featIdx}`
                                ? 'border-yellow-500'
                                : 'border-transparent'
                            }`}
                          >
                            <span className="font-bold text-slate-200 mr-2">{feat.name}</span>
                            <span className="text-slate-400">{feat.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <button onClick={() => removeGroup(instances)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>

                  <div className="flex items-center gap-2 mb-1 pr-8">
                    <h3 className="text-xl font-bold text-white">
                      {el.name}
                      {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                    </h3>
                    {el.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{el.groupName}</span>}
                  </div>

                  <div className="text-sm text-slate-400 mb-2 capitalize">
                    Tier {el.tier || 0} {el.role}
                  </div>

                  {el.description && (
                    <div className="text-sm italic text-slate-300 mb-4 whitespace-pre-wrap">{el.description}</div>
                  )}

                  {(el.motive || (el.experiences && el.experiences.length > 0)) && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {el.motive && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h4>
                          <p className="text-sm text-slate-300">{el.motive}</p>
                        </div>
                      )}
                      {el.experiences && el.experiences.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h4>
                          <div className="flex flex-wrap gap-2">
                            {el.experiences.map(exp => (
                              <span key={exp.id} className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                                {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats header + per-instance HP/Stress/Conditions rows */}
                  <div className="mb-6 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex gap-6 text-sm font-medium border-b border-slate-800 pb-3 mb-3">
                      <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-lg">{el.difficulty || '-'}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-lg">{el.hp_max || '-'}</span></div>
                      <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-lg">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span></div>
                    </div>

                    <div className="space-y-2">
                      {instances.map((inst, idx) => (
                        <div key={inst.instanceId} className="flex items-center gap-2">
                          {count > 1 && (
                            <span className="text-xs text-slate-500 w-4 flex-shrink-0 text-right">{idx + 1}</span>
                          )}

                          <div className="flex items-center gap-1">
                            <Heart size={12} className="text-red-500 flex-shrink-0" />
                            <input
                              type="number"
                              value={inst.currentHp}
                              onChange={(e) => updateActiveElement(inst.instanceId, { currentHp: parseInt(e.target.value) || 0 })}
                              className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-red-500 text-sm"
                            />
                            <span className="text-slate-500 text-xs">/{el.hp_max}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <AlertCircle size={12} className="text-purple-500 flex-shrink-0" />
                            <input
                              type="number"
                              value={inst.currentStress}
                              onChange={(e) => updateActiveElement(inst.instanceId, { currentStress: parseInt(e.target.value) || 0 })}
                              className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-purple-500 text-sm"
                            />
                            <span className="text-slate-500 text-xs">/{el.stress_max}</span>
                          </div>

                          <input
                            type="text"
                            placeholder="Conditions..."
                            value={inst.conditions || ''}
                            onChange={(e) => updateActiveElement(inst.instanceId, { conditions: e.target.value })}
                            className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                          />

                          {count > 1 && (
                            <button
                              onClick={() => removeActiveElement(inst.instanceId)}
                              className="text-slate-600 hover:text-red-500 flex-shrink-0"
                              title="Remove this copy"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {el.attack && el.attack.name && (
                    <div className="space-y-2 mb-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Attack</h4>
                      <div
                        className={`text-sm pl-2 border-l-2 transition-colors ${
                          hoveredFeature?.cardKey === advCardKey && hoveredFeature?.featureKey === 'attack'
                            ? 'border-yellow-500'
                            : 'border-transparent'
                        }`}
                      >
                        <span className="font-bold text-slate-200">{el.attack.name}:</span>
                        <span className="text-slate-300"> {el.attack.modifier >= 0 ? '+' : ''}{el.attack.modifier} {el.attack.range} | {el.attack.damage} {el.attack.trait?.toLowerCase()}</span>
                      </div>
                    </div>
                  )}

                  {el.features && el.features.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h4>
                      {el.features.map((feat, featIdx) => (
                        <div
                          key={feat.id ?? featIdx}
                          className={`text-sm pl-2 border-l-2 transition-colors ${
                            hoveredFeature?.cardKey === advCardKey && hoveredFeature?.featureKey === `feat-${featIdx}`
                              ? 'border-yellow-500'
                              : 'border-transparent'
                          }`}
                        >
                          <span className="font-bold text-slate-200 mr-2">{feat.name}</span>
                          <span className="text-slate-400">{feat.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
  );
}
