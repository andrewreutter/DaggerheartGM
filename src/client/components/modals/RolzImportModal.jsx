import { useState } from 'react';
import { parseRolzMarkdown } from '../../lib/rolz-parser.js';
import { generateId } from '../../lib/helpers.js';
import {
  ImportModalShell,
  ImportSuccessStep,
  ImportPreviewSection,
  ImportPreviewSummary,
  useImportSelection,
} from './ImportModalShell.jsx';

export function RolzImportModal({ onClose, saveItem, onImportSuccess, data }) {
  const [step, setStep] = useState('paste'); // paste | preview | success
  const [markdown, setMarkdown] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);

  const [sceneName, setSceneName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);
  const { selectedIds, setSelectedIds, toggleId } = useImportSelection();

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

      const envs = result.environments.map(e => ({ ...e, id: generateId() }));
      const advs = result.adversaries.map(a => ({ ...a, id: generateId() }));
      setEditEnvs(envs);
      setEditAdvs(advs);
      setSelectedIds(new Set([
        ...envs.map(e => e.id),
        ...advs.map(a => a.id),
        '__scene__',
        ...(advs.length > 0 ? ['__group__'] : []),
      ]));
      setStep('preview');
    } catch (err) {
      setParseError(`Parse error: ${err.message}`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    const selectedAdvs = editAdvs.filter(a => selectedIds.has(a.id));
    const selectedEnvs = editEnvs.filter(e => selectedIds.has(e.id));
    const shouldCreateGroup = selectedIds.has('__group__') && selectedAdvs.length > 0;
    const shouldCreateScene = selectedIds.has('__scene__');

    const savedAdvIds = [];
    for (const adv of selectedAdvs) {
      const { count, id, ...advData } = adv;
      await saveItem('adversaries', { id, ...advData });
      savedAdvIds.push({ id, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name });
    }

    const savedEnvIds = [];
    for (const env of selectedEnvs) {
      const { id, ...envData } = env;
      await saveItem('environments', { id, ...envData });
      savedEnvIds.push(id);
      created.push({ collection: 'environments', id, name: env.name });
    }

    let savedGroupId = null;
    if (shouldCreateGroup) {
      savedGroupId = generateId();
      const group = {
        id: savedGroupId,
        name: groupName,
        description: '',
        adversaries: savedAdvIds.map(a => ({ adversaryId: a.id, count: a.count })),
      };
      await saveItem('groups', group);
      created.push({ collection: 'groups', id: savedGroupId, name: groupName });
    }

    if (shouldCreateScene) {
      const sceneId = generateId();
      const scene = {
        id: sceneId,
        name: sceneName,
        description: '',
        imageUrl: parsed?.imageUrl || '',
        environments: savedEnvIds,
        groups: savedGroupId ? [savedGroupId] : [],
        adversaries: [],
      };
      await saveItem('scenes', scene);
      created.push({ collection: 'scenes', id: sceneId, name: sceneName });
    }

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const selAdvCount = editAdvs.filter(a => selectedIds.has(a.id)).length;
  const selEnvCount = editEnvs.filter(e => selectedIds.has(e.id)).length;
  const willCreateGroup = selectedIds.has('__group__') && selAdvCount > 0;
  const willCreateScene = selectedIds.has('__scene__');
  const summaryParts = [
    selAdvCount ? `${selAdvCount} adversar${selAdvCount === 1 ? 'y' : 'ies'}` : '',
    willCreateGroup ? '→ 1 group' : '',
    selEnvCount ? `${selEnvCount} environment${selEnvCount === 1 ? '' : 's'}` : '',
    willCreateScene ? '→ 1 scene' : '',
  ].filter(Boolean).join(' · ');

  const hasAnythingToImport = selAdvCount > 0 || selEnvCount > 0 || willCreateGroup || willCreateScene;

  const titles = { paste: 'Import Rolz Markdown', preview: 'Preview Import', success: 'Import Complete' };

  const footer = (
    <>
      {step === 'paste' && (
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          <button onClick={handlePreview} disabled={!markdown.trim()} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm">Preview</button>
        </>
      )}
      {step === 'preview' && (
        <>
          <button onClick={() => setStep('paste')} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Back</button>
          <button
            onClick={handleImport}
            disabled={importing || !hasAnythingToImport}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </>
      )}
      {step === 'success' && (
        <button onClick={onClose} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-sm">Close</button>
      )}
    </>
  );

  return (
    <ImportModalShell title={titles[step]} onClose={onClose} footer={footer}>
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
          {/* Scene and group container toggles — Rolz-specific */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                id="create-scene"
                checked={selectedIds.has('__scene__')}
                onChange={() => toggleId('__scene__')}
                style={{ accentColor: '#ef4444' }}
                className="cursor-pointer flex-shrink-0"
              />
              <label htmlFor="create-scene" className="text-xs text-slate-400 uppercase tracking-wider font-medium flex-shrink-0 cursor-pointer">
                Create Scene
              </label>
              <input
                type="text"
                value={sceneName}
                onChange={e => setSceneName(e.target.value)}
                disabled={!selectedIds.has('__scene__')}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-sm outline-none focus:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {editAdvs.length > 0 && (
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  id="create-group"
                  checked={selectedIds.has('__group__')}
                  onChange={() => toggleId('__group__')}
                  style={{ accentColor: '#ef4444' }}
                  className="cursor-pointer flex-shrink-0"
                />
                <label htmlFor="create-group" className="text-xs text-slate-400 uppercase tracking-wider font-medium flex-shrink-0 cursor-pointer">
                  Create Group
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  disabled={!selectedIds.has('__group__')}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-sm outline-none focus:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>

          <ImportPreviewSection
            label="Environments"
            items={editEnvs}
            collection="environments"
            existingItems={data?.environments || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updated => setEditEnvs(prev => prev.map(e => e.id === updated.id ? updated : e))}
            colorScheme="red"
          />

          <ImportPreviewSection
            label="Adversaries"
            items={editAdvs}
            collection="adversaries"
            existingItems={data?.adversaries || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updated => setEditAdvs(prev => prev.map(a => a.id === updated.id ? updated : a))}
            colorScheme="red"
          />

          <ImportPreviewSummary summaryParts={summaryParts} />
        </div>
      )}

      {step === 'success' && (
        <ImportSuccessStep
          importedItems={importedItems}
          onImportSuccess={onImportSuccess}
          onClose={onClose}
          colorScheme="red"
        />
      )}
    </ImportModalShell>
  );
}
