import { useState } from 'react';
import { X } from 'lucide-react';
import { parseRolzMarkdown } from '../../lib/rolz-parser.js';
import { generateId } from '../../lib/helpers.js';

export function RolzImportModal({ onClose, saveItem, onImportSuccess }) {
  const [step, setStep] = useState('paste'); // paste | preview | success
  const [markdown, setMarkdown] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);

  const [sceneName, setSceneName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);

  const [importedItems, setImportedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const handlePreview = () => {
    setParseError('');
    try {
      const result = parseRolzMarkdown(markdown);
      if (!result.sceneName && result.environments.length === 0 && result.adversaries.length === 0) {
        setParseError('Nothing recognizable was found. Make sure to paste a valid Rolz scene block starting with =Scene Name.');
        return;
      }
      setParsed(result);
      setSceneName(result.sceneName || 'Imported Scene');
      setGroupName(result.sceneName ? `${result.sceneName} - Adversaries` : 'Imported Group');
      setEditEnvs(result.environments.map(e => ({ ...e, id: generateId() })));
      setEditAdvs(result.adversaries.map(a => ({ ...a, id: generateId() })));
      setStep('preview');
    } catch (err) {
      setParseError(`Parse error: ${err.message}`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    const savedAdvIds = [];
    for (const adv of editAdvs) {
      const { count, id, ...advData } = adv;
      await saveItem('adversaries', { id, ...advData });
      savedAdvIds.push({ id, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name });
    }

    const savedEnvIds = [];
    for (const env of editEnvs) {
      const { id, ...envData } = env;
      await saveItem('environments', { id, ...envData });
      savedEnvIds.push(id);
      created.push({ collection: 'environments', id, name: env.name });
    }

    let savedGroupId = null;
    if (savedAdvIds.length > 0) {
      savedGroupId = generateId();
      const group = {
        id: savedGroupId,
        name: groupName,
        description: '',
        adversaries: savedAdvIds.map(a => ({ adversaryId: a.id, count: a.count }))
      };
      await saveItem('groups', group);
      created.push({ collection: 'groups', id: savedGroupId, name: groupName });
    }

    const sceneId = generateId();
    const scene = {
      id: sceneId,
      name: sceneName,
      description: '',
      imageUrl: parsed?.imageUrl || '',
      environments: savedEnvIds,
      groups: savedGroupId ? [savedGroupId] : [],
      adversaries: []
    };
    await saveItem('scenes', scene);
    created.push({ collection: 'scenes', id: sceneId, name: sceneName });

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const updateAdv = (idx, key, val) => {
    setEditAdvs(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a));
  };

  const updateEnv = (idx, key, val) => {
    setEditEnvs(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            {step === 'paste' && 'Import Rolz Markdown'}
            {step === 'preview' && 'Preview Import'}
            {step === 'success' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'paste' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Paste your Rolz.org wiki scene block below. The importer will extract the Scene, Environment(s), Adversaries, and create a Group automatically.
              </p>
              <textarea
                className="w-full h-72 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono resize-none outline-none focus:border-red-500"
                placeholder="Paste Rolz markdown here..."
                value={markdown}
                onChange={e => setMarkdown(e.target.value)}
              />
              {parseError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{parseError}</div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Scene Name</label>
                  <input type="text" value={sceneName} onChange={e => setSceneName(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-red-500" />
                </div>
                {editAdvs.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Group Name</label>
                    <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-red-500" />
                  </div>
                )}
              </div>

              {editEnvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">
                    Environments ({editEnvs.length})
                  </h3>
                  <div className="space-y-3">
                    {editEnvs.map((env, idx) => (
                      <div key={env.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                        <input type="text" value={env.name} onChange={e => updateEnv(idx, 'name', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold w-full mb-2 outline-none focus:border-red-500" />
                        {env.description && <p className="text-xs text-slate-400 italic mb-2 line-clamp-3">{env.description}</p>}
                        {env.features.length > 0 && <div className="text-xs text-slate-500">{env.features.length} feature(s)</div>}
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
                          <input type="text" value={adv.name} onChange={e => updateAdv(idx, 'name', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm font-bold outline-none focus:border-red-500" />
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>×</span>
                            <input type="number" min="1" value={adv.count} onChange={e => updateAdv(idx, 'count', parseInt(e.target.value) || 1)} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-white text-center text-sm outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 mb-2">
                          <span>DC {adv.difficulty}</span>
                          <span>HP {adv.hp_max}</span>
                          <span>Thresholds {adv.hp_thresholds?.major}/{adv.hp_thresholds?.severe}</span>
                          <span>Stress {adv.stress_max}</span>
                        </div>
                        {adv.attack?.name && (
                          <div className="text-xs text-slate-400 mb-1">
                            ⚔ <span className="text-slate-300">{adv.attack.name}</span>: {adv.attack.modifier >= 0 ? '+' : ''}{adv.attack.modifier} {adv.attack.range} | {adv.attack.damage} {adv.attack.trait?.toLowerCase()}
                          </div>
                        )}
                        {adv.features.length > 0 && (
                          <div className="text-xs text-slate-500">{adv.features.length} feature(s) · {adv.experiences.length} experience(s)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-950 rounded-lg p-3 border border-slate-800">
                Will create: {editAdvs.length} adversar{editAdvs.length === 1 ? 'y' : 'ies'}{editAdvs.length > 0 ? ` → 1 group` : ''}{editEnvs.length > 0 ? ` · ${editEnvs.length} environment(s)` : ''} → 1 scene
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
                    <span className="text-white group-hover:text-red-400 font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{item.collection.replace(/s$/, '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          {step === 'paste' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handlePreview} disabled={!markdown.trim()} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm">Preview</button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('paste')} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Back</button>
              <button onClick={handleImport} disabled={importing} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2">
                {importing ? 'Importing...' : 'Import'}
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
