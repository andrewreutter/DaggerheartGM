import { useState } from 'react';
import { X } from 'lucide-react';
import { fetchFCG } from '../../lib/api.js';
import { generateId } from '../../lib/helpers.js';

export function FCGImportModal({ onClose, saveItem, onImportSuccess }) {
  const [step, setStep] = useState('url'); // url | loading | preview | success
  const [url, setUrl] = useState('');
  const [fetchError, setFetchError] = useState('');

  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);
  const [editEncounters, setEditEncounters] = useState([]);

  const [importedItems, setImportedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleFetch = async () => {
    setFetchError('');
    setStep('loading');
    try {
      const result = await fetchFCG(url);
      if (!result.adversaries.length && !result.environments.length && !result.encounters.length) {
        throw new Error('Nothing found at that URL. Check the URL is a valid FreshCutGrass homebrew page.');
      }
      setEditEnvs(result.environments.map(e => ({ ...e, id: generateId() })));
      setEditAdvs(result.adversaries.map(a => ({ ...a, id: generateId() })));
      setEditEncounters(result.encounters.map(e => ({ ...e, id: generateId() })));
      setStep('preview');
    } catch (err) {
      setFetchError(err.message);
      setStep('url');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    const savedAdvs = [];
    for (const adv of editAdvs) {
      const { count, id, ...advData } = adv;
      await saveItem('adversaries', { id, ...advData });
      savedAdvs.push({ id, name: adv.name, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name });
    }

    const savedEnvs = [];
    for (const env of editEnvs) {
      const { id, ...envData } = env;
      await saveItem('environments', { id, ...envData });
      savedEnvs.push({ id, name: env.name });
      created.push({ collection: 'environments', id, name: env.name });
    }

    for (const enc of editEncounters) {
      const rawLower = (enc.rawText || enc.name || '').toLowerCase();

      const matchedAdvRefs = savedAdvs
        .filter(a => rawLower.includes(a.name.toLowerCase()))
        .map(a => ({ adversaryId: a.id, count: a.count }));

      const matchedEnvIds = savedEnvs
        .filter(e => rawLower.includes(e.name.toLowerCase()))
        .map(e => e.id);

      await saveItem('scenes', {
        id: enc.id,
        name: enc.name,
        description: enc.description || '',
        imageUrl: '',
        environments: matchedEnvIds,
        groups: [],
        adversaries: matchedAdvRefs,
      });
      created.push({ collection: 'scenes', id: enc.id, name: enc.name });
    }

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const updateAdv = (idx, key, val) =>
    setEditAdvs(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a));

  const updateEnv = (idx, key, val) =>
    setEditEnvs(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));

  const updateEncounter = (idx, key, val) =>
    setEditEncounters(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));

  const summaryParts = [
    editAdvs.length ? `${editAdvs.length} adversar${editAdvs.length === 1 ? 'y' : 'ies'}` : '',
    editEnvs.length ? `${editEnvs.length} environment${editEnvs.length === 1 ? '' : 's'}` : '',
    editEncounters.length ? `${editEncounters.length} scene${editEncounters.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            {step === 'url' && 'Import from FreshCutGrass.app'}
            {step === 'loading' && 'Fetching\u2026'}
            {step === 'preview' && 'Preview Import'}
            {step === 'success' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Paste a FreshCutGrass.app homebrew sharing URL (e.g.{' '}
                <code className="text-green-400 text-xs">https://freshcutgrass.app/homebrew/username</code>).
                Adversaries, environments, and encounters will be imported; encounters become scenes.
              </p>
              <input
                type="url"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-green-600"
                placeholder="https://freshcutgrass.app/homebrew/username"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url.trim() && handleFetch()}
              />
              {fetchError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{fetchError}</div>
              )}
              <p className="text-xs text-slate-500">
                This uses a headless browser on the server to render the page — it may take 20–40 seconds.
              </p>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Fetching from FreshCutGrass.app\u2026</p>
              <p className="text-slate-600 text-xs">This may take 20–40 seconds</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {editEnvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Environments ({editEnvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editEnvs.map((env, idx) => (
                      <div key={env.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <input type="text" value={env.name} onChange={e => updateEnv(idx, 'name', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-green-600" />
                        <div className="flex gap-3 text-xs text-slate-500 mb-1">
                          <span className="capitalize">{env.type}</span>
                          <span>Tier {env.tier}</span>
                        </div>
                        {env.description && <p className="text-xs text-slate-400 italic mb-2 line-clamp-3">{env.description}</p>}
                        {env.features?.length > 0 && <div className="text-xs text-slate-500">{env.features.length} feature(s)</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editAdvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Adversaries ({editAdvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editAdvs.map((adv, idx) => (
                      <div key={adv.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <input type="text" value={adv.name} onChange={e => updateAdv(idx, 'name', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold outline-none focus:border-green-600" />
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>×</span>
                            <input type="number" min="1" value={adv.count ?? 1} onChange={e => updateAdv(idx, 'count', parseInt(e.target.value) || 1)} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-white text-center text-sm outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 mb-2">
                          <span>DC {adv.difficulty}</span>
                          <span>HP {adv.hp_max}</span>
                          <span>Thresholds {adv.hp_thresholds?.major}/{adv.hp_thresholds?.severe}</span>
                          <span>Stress {adv.stress_max}</span>
                        </div>
                        <div className="text-xs text-slate-500 capitalize mb-1">{adv.role} · Tier {adv.tier}</div>
                        {adv.attack?.name && (
                          <div className="text-xs text-slate-400 mb-1">
                            ⚔ <span className="text-slate-300">{adv.attack.name}</span>: {adv.attack.modifier >= 0 ? '+' : ''}{adv.attack.modifier} {adv.attack.range} | {adv.attack.damage} {adv.attack.trait?.toLowerCase()}
                          </div>
                        )}
                        {adv.features?.length > 0 && <div className="text-xs text-slate-500">{adv.features.length} feature(s)</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editEncounters.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Encounters → Scenes ({editEncounters.length})
                  </h3>
                  <div className="space-y-3">
                    {editEncounters.map((enc, idx) => {
                      const rawLower = (enc.rawText || enc.name || '').toLowerCase();
                      const matchedAdvNames = editAdvs.filter(a => rawLower.includes(a.name.toLowerCase())).map(a => a.name);
                      const matchedEnvNames = editEnvs.filter(e => rawLower.includes(e.name.toLowerCase())).map(e => e.name);
                      return (
                        <div key={enc.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                          <input type="text" value={enc.name} onChange={e => updateEncounter(idx, 'name', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-green-600" />
                          {enc.description && <p className="text-xs text-slate-400 italic mb-2 line-clamp-2">{enc.description}</p>}
                          {(matchedAdvNames.length > 0 || matchedEnvNames.length > 0) && (
                            <div className="text-xs text-slate-500 space-y-0.5">
                              {matchedAdvNames.length > 0 && <div>⚔ {matchedAdvNames.join(', ')}</div>}
                              {matchedEnvNames.length > 0 && <div>🗺 {matchedEnvNames.join(', ')}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-950 rounded-lg p-3 border border-slate-800">
                Will create: {summaryParts || 'nothing'}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4">
              <p className="text-green-400 font-medium">Import complete! The following items were created:</p>
              <div className="space-y-2">
                {importedItems.map(item => (
                  <button
                    key={`${item.collection}-${item.id}`}
                    onClick={() => { onImportSuccess(item.collection, item.id); onClose(); }}
                    className="w-full text-left bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-3 flex items-center justify-between group transition-colors"
                  >
                    <span className="text-white group-hover:text-green-400 font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{item.collection.replace(/s$/, '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          {step === 'url' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleFetch} disabled={!url.trim()} className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm">Fetch</button>
            </>
          )}
          {step === 'loading' && (
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('url')} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Back</button>
              <button onClick={handleImport} disabled={importing} className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2">
                {importing ? 'Importing\u2026' : 'Import'}
              </button>
            </>
          )}
          {step === 'success' && (
            <button onClick={onClose} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-sm">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
