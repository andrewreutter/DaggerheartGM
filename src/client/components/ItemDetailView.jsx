import { useState, useMemo } from 'react';
import { X, Copy, Edit, Heart, AlertCircle } from 'lucide-react';
import { generateRolzExport } from '../lib/rolz-export.js';
import { generateId, parseFeatureCategory } from '../lib/helpers.js';

function buildElements(item, tab, data) {
  const elements = [];

  const pushAdversary = (adv, groupName) => {
    elements.push({
      ...adv,
      instanceId: generateId(),
      elementType: 'adversary',
      currentHp: adv.hp_max || 0,
      currentStress: 0,
      conditions: '',
      ...(groupName ? { groupName } : {}),
    });
  };

  const pushEnvironment = (env) => {
    elements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
  };

  if (tab === 'groups') {
    item.adversaries?.forEach(advRef => {
      const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
      if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv, item.name);
    });
  } else if (tab === 'scenes') {
    item.environments?.forEach(envId => {
      const env = data.environments?.find(e => e.id === envId);
      if (env) pushEnvironment(env);
    });
    item.adversaries?.forEach(advRef => {
      const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
      if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv);
    });
    item.groups?.forEach(groupId => {
      const group = data.groups?.find(g => g.id === groupId);
      if (group) {
        group.adversaries?.forEach(advRef => {
          const adv = data.adversaries?.find(a => a.id === advRef.adversaryId);
          if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv, group.name);
        });
      }
    });
  }

  return elements;
}

function ExpandedTablePreview({ item, tab, data }) {
  const [elements, setElements] = useState(() => buildElements(item, tab, data));
  const [hoveredFeature, setHoveredFeature] = useState(null);

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

  if (elements.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-6 border border-dashed border-slate-800 rounded-lg mt-4">
        No elements in this {tab === 'groups' ? 'group' : 'scene'}.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
      {consolidated.map(entry => {
        if (entry.kind === 'environment') {
          const el = entry.element;
          const cardKey = el.instanceId;
          return (
            <div key={el.instanceId} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              {el.imageUrl && (
                <div className="w-full h-32 overflow-hidden">
                  <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </div>
              )}
              <div className="p-4">
                <h4 className="text-lg font-bold text-white mb-0.5">{el.name}</h4>
                <div className="text-xs text-slate-400 mb-2 capitalize">Tier {el.tier || 0} {el.type} Environment</div>
                <div className="inline-flex mb-3 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                  <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase leading-none mb-0.5">Difficulty</span><span className="text-base font-semibold text-white">{el.difficulty || '-'}</span></div>
                </div>
                {el.description && <p className="text-sm italic text-slate-300 mb-3 whitespace-pre-wrap">{el.description}</p>}
                {el.features && el.features.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
                    {el.features.map((feat, idx) => (
                      <div
                        key={feat.id ?? idx}
                        className={`text-sm pl-2 border-l-2 transition-colors ${hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === `feat-${idx}` ? 'border-yellow-500' : 'border-transparent'}`}
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

        const { baseElement: el, instances } = entry;
        const count = instances.length;
        const advCardKey = `${el.id}|${el.groupName || ''}`;

        return (
          <div key={advCardKey} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            {el.imageUrl && (
              <div className="w-full h-32 overflow-hidden">
                <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover opacity-80" onError={e => { e.target.parentElement.style.display = 'none'; }} />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-lg font-bold text-white">
                  {el.name}
                  {count > 1 && <span className="text-slate-400 font-normal ml-1.5">×{count}</span>}
                </h4>
                {el.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{el.groupName}</span>}
              </div>
              <div className="text-xs text-slate-400 mb-3 capitalize">Tier {el.tier || 0} {el.role}</div>

              {el.description && <p className="text-sm italic text-slate-300 mb-3 whitespace-pre-wrap">{el.description}</p>}

              {(el.motive || (el.experiences && el.experiences.length > 0)) && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {el.motive && (
                    <div>
                      <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-1">Motives & Tactics</h5>
                      <p className="text-sm text-slate-300">{el.motive}</p>
                    </div>
                  )}
                  {el.experiences && el.experiences.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-1">Experiences</h5>
                      <div className="flex flex-wrap gap-1">
                        {el.experiences.map(exp => (
                          <span key={exp.id} className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="flex gap-4 text-sm font-medium border-b border-slate-800 pb-2 mb-2">
                  <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-base">{el.difficulty || '-'}</span></div>
                  <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-base">{el.hp_max || '-'}</span></div>
                  <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-base">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span></div>
                </div>
                <div className="space-y-2">
                  {instances.map((inst, idx) => (
                    <div key={inst.instanceId} className="flex items-center gap-2">
                      {count > 1 && <span className="text-xs text-slate-500 w-4 flex-shrink-0 text-right">{idx + 1}</span>}
                      <div className="flex items-center gap-1">
                        <Heart size={12} className="text-red-500 flex-shrink-0" />
                        <input
                          type="number"
                          value={inst.currentHp}
                          onChange={e => updateElement(inst.instanceId, { currentHp: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-red-500 text-sm"
                        />
                        <span className="text-slate-500 text-xs">/{el.hp_max}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle size={12} className="text-purple-500 flex-shrink-0" />
                        <input
                          type="number"
                          value={inst.currentStress}
                          onChange={e => updateElement(inst.instanceId, { currentStress: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-purple-500 text-sm"
                        />
                        <span className="text-slate-500 text-xs">/{el.stress_max}</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Conditions..."
                        value={inst.conditions || ''}
                        onChange={e => updateElement(inst.instanceId, { conditions: e.target.value })}
                        className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {el.attack && el.attack.name && (
                <div className="space-y-1 mb-3">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Attack</h5>
                  <div
                    className={`text-sm pl-2 border-l-2 transition-colors ${hoveredFeature?.cardKey === advCardKey && hoveredFeature?.featureKey === 'attack' ? 'border-yellow-500' : 'border-transparent'}`}
                  >
                    <span className="font-bold text-slate-200">{el.attack.name}:</span>
                    <span className="text-slate-300"> {el.attack.modifier >= 0 ? '+' : ''}{el.attack.modifier} {el.attack.range} | {el.attack.damage} {el.attack.trait?.toLowerCase()}</span>
                  </div>
                </div>
              )}

              {el.features && el.features.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
                  {el.features.map((feat, featIdx) => (
                    <div
                      key={feat.id ?? featIdx}
                      className={`text-sm pl-2 border-l-2 transition-colors ${hoveredFeature?.cardKey === advCardKey && hoveredFeature?.featureKey === `feat-${featIdx}` ? 'border-yellow-500' : 'border-transparent'}`}
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
    </div>
  );
}

export function ItemDetailView({ item, tab, data, onEdit, onClose }) {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg shadow-xl relative overflow-hidden ${(tab === 'groups' || tab === 'scenes') ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={20} /></button>

      {item.imageUrl && (
        <div className="w-full h-56 overflow-hidden bg-slate-950">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-90" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}

      <div className="p-6">
        <div className="mb-6 pr-8">
          <h2 className="text-3xl font-bold text-white mb-1">{item.name}</h2>
          <div className="text-slate-400 uppercase tracking-wider text-sm font-medium mb-2">
            {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
            {tab === 'environments' && `Tier ${item.tier || 0} ${item.type} Environment`}
            {tab === 'groups' && 'Group'}
            {tab === 'scenes' && 'Scene'}
            {tab === 'adventures' && 'Adventure'}
          </div>
          {item.description && (
            <div className="text-slate-300 italic whitespace-pre-wrap text-sm">{item.description}</div>
          )}
        </div>

        {(tab === 'groups' || tab === 'scenes') && data && (
          <ExpandedTablePreview item={item} tab={tab} data={data} />
        )}

        {tab === 'adversaries' && (item.motive || (item.experiences && item.experiences.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {item.motive && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h3>
                <p className="text-sm text-slate-300">{item.motive}</p>
              </div>
            )}
            {item.experiences && item.experiences.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h3>
                <div className="flex flex-wrap gap-2">
                  {item.experiences.map(exp => (
                    <span key={exp.id} className="text-sm bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                      {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'adversaries' && (
          <div className="grid grid-cols-4 gap-4 mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-xl text-white">{item.difficulty || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-xl text-white">{item.hp_max || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-xl text-white">{item.hp_thresholds?.major || '-'}/{item.hp_thresholds?.severe || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Stress</span><span className="text-xl text-white">{item.stress_max || '-'}</span></div>
          </div>
        )}

        {tab === 'environments' && (
          <div className="inline-flex mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-xl text-white">{item.difficulty || '-'}</span></div>
          </div>
        )}

        {item.attack && item.attack.name && (
          <div className="mb-6 space-y-3">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Attack</h3>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="font-bold text-red-400">{item.attack.name}:</span>
              <span className="text-slate-300"> {item.attack.modifier >= 0 ? '+' : ''}{item.attack.modifier} {item.attack.range} | {item.attack.damage} {item.attack.trait?.toLowerCase()}</span>
            </div>
          </div>
        )}

        {item.features && item.features.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Features</h3>
            {item.features.map(f => (
              <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-red-400">{f.name}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider">{f.type}</span>
                </div>
                <p className="text-sm text-slate-300">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <button
            onClick={handleCopyRolz}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 text-sm transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy Rolz'}
          </button>
          <button onClick={onEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
            <Edit size={16} /> Edit {item.name}
          </button>
        </div>
      </div>
    </div>
  );
}
