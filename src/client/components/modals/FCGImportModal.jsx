import { useState } from 'react';
import { fetchFCG } from '../../lib/api.js';
import { generateId } from '../../lib/helpers.js';
import { ImportPreviewCard } from './ImportPreviewCard.jsx';
import {
  ImportModalShell,
  ImportSuccessStep,
  ImportPreviewSection,
  ImportPreviewSummary,
  useImportSelection,
} from './ImportModalShell.jsx';

export function FCGImportModal({ onClose, saveItem, onImportSuccess, data }) {
  const [step, setStep] = useState('url'); // url | loading | preview | success
  const [url, setUrl] = useState('');
  const [fetchError, setFetchError] = useState('');

  const [editEnvs, setEditEnvs] = useState([]);
  const [editAdvs, setEditAdvs] = useState([]);
  const [editEncounters, setEditEncounters] = useState([]);
  const { selectedIds, setSelectedIds, toggleId, replaceIds, toggleReplaceId } = useImportSelection();

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
      const envs = result.environments.map(e => ({ ...e, id: generateId() }));
      const advs = result.adversaries.map(a => ({ ...a, id: generateId() }));
      const encounters = result.encounters.map(e => ({ ...e, id: generateId() }));
      setEditEnvs(envs);
      setEditAdvs(advs);
      setEditEncounters(encounters);
      setSelectedIds(new Set([
        ...envs.map(e => e.id),
        ...advs.map(a => a.id),
        ...encounters.map(e => e.id),
      ]));
      setStep('preview');
    } catch (err) {
      setFetchError(err.message);
      setStep('url');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];

    const selectedAdvsList = editAdvs.filter(a => selectedIds.has(a.id));
    const selectedEnvsList = editEnvs.filter(e => selectedIds.has(e.id));
    const selectedEncounters = editEncounters.filter(enc => selectedIds.has(enc.id));

    const savedAdvs = [];
    for (const adv of selectedAdvsList) {
      const { count, id: importId, ...advData } = adv;
      const existingDup = (data?.adversaries || []).find(
        e => e.name.trim().toLowerCase() === adv.name.trim().toLowerCase()
      );
      const id = replaceIds.has(importId) && existingDup ? existingDup.id : importId;
      const replaced = replaceIds.has(importId) && !!existingDup;
      await saveItem('adversaries', { id, ...advData });
      savedAdvs.push({ id, name: adv.name, count: count || 1 });
      created.push({ collection: 'adversaries', id, name: adv.name, replaced });
    }

    const savedEnvs = [];
    for (const env of selectedEnvsList) {
      const { id: importId, ...envData } = env;
      const existingDup = (data?.environments || []).find(
        e => e.name.trim().toLowerCase() === env.name.trim().toLowerCase()
      );
      const id = replaceIds.has(importId) && existingDup ? existingDup.id : importId;
      const replaced = replaceIds.has(importId) && !!existingDup;
      await saveItem('environments', { id, ...envData });
      savedEnvs.push({ id, name: env.name });
      created.push({ collection: 'environments', id, name: env.name, replaced });
    }

    for (const enc of selectedEncounters) {
      const rawLower = (enc.rawText || enc.name || '').toLowerCase();

      const matchedAdvRefs = savedAdvs
        .filter(a => rawLower.includes(a.name.toLowerCase()))
        .map(a => ({ adversaryId: a.id, count: a.count }));

      const matchedEnvIds = savedEnvs
        .filter(e => rawLower.includes(e.name.toLowerCase()))
        .map(e => e.id);

      const existingDup = (data?.scenes || []).find(
        e => e.name.trim().toLowerCase() === enc.name.trim().toLowerCase()
      );
      const sceneId = replaceIds.has(enc.id) && existingDup ? existingDup.id : enc.id;
      const replaced = replaceIds.has(enc.id) && !!existingDup;

      await saveItem('scenes', {
        id: sceneId,
        name: enc.name,
        description: enc.description || '',
        imageUrl: '',
        environments: matchedEnvIds,
        groups: [],
        adversaries: matchedAdvRefs,
      });
      created.push({ collection: 'scenes', id: sceneId, name: enc.name, replaced });
    }

    setImportedItems(created);
    setImporting(false);
    setStep('success');
  };

  const selAdvCount = editAdvs.filter(a => selectedIds.has(a.id)).length;
  const selEnvCount = editEnvs.filter(e => selectedIds.has(e.id)).length;
  const selEncCount = editEncounters.filter(enc => selectedIds.has(enc.id)).length;
  const summaryParts = [
    selAdvCount ? `${selAdvCount} adversar${selAdvCount === 1 ? 'y' : 'ies'}` : '',
    selEnvCount ? `${selEnvCount} environment${selEnvCount === 1 ? '' : 's'}` : '',
    selEncCount ? `${selEncCount} scene${selEncCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');

  const hasAnythingToImport = selAdvCount > 0 || selEnvCount > 0 || selEncCount > 0;

  const titles = {
    url: 'Import from FreshCutGrass.app',
    loading: 'Fetching…',
    preview: 'Preview Import',
    success: 'Import Complete',
  };

  const footer = (
    <>
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
          <button
            onClick={handleImport}
            disabled={importing || !hasAnythingToImport}
            className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium text-sm flex items-center gap-2"
          >
            {importing ? 'Importing…' : 'Import'}
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
          <p className="text-slate-400 text-sm">Fetching from FreshCutGrass.app…</p>
          <p className="text-slate-600 text-xs">This may take 20–40 seconds</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <ImportPreviewSection
            label="Environments"
            items={editEnvs}
            collection="environments"
            existingItems={data?.environments || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updated => setEditEnvs(prev => prev.map(e => e.id === updated.id ? updated : e))}
            colorScheme="green"
            replaceIds={replaceIds}
            onToggleReplaceId={toggleReplaceId}
          />

          <ImportPreviewSection
            label="Adversaries"
            items={editAdvs}
            collection="adversaries"
            existingItems={data?.adversaries || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updated => setEditAdvs(prev => prev.map(a => a.id === updated.id ? updated : a))}
            colorScheme="green"
            replaceIds={replaceIds}
            onToggleReplaceId={toggleReplaceId}
          />

          {/* Encounters → Scenes: custom summary content per card showing matched elements */}
          <ImportPreviewSection
            label="Encounters → Scenes"
            items={editEncounters}
            collection="scenes"
            existingItems={data?.scenes || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updated => setEditEncounters(prev => prev.map(e => e.id === updated.id ? updated : e))}
            colorScheme="green"
            renderCard={enc => {
              const rawLower = (enc.rawText || enc.name || '').toLowerCase();
              const matchedAdvNames = editAdvs
                .filter(a => rawLower.includes(a.name.toLowerCase()))
                .map(a => a.name);
              const matchedEnvNames = editEnvs
                .filter(e => rawLower.includes(e.name.toLowerCase()))
                .map(e => e.name);
              return (
                <ImportPreviewCard
                  key={enc.id}
                  item={enc}
                  collection="scenes"
                  existingItems={data?.scenes || []}
                  selected={selectedIds.has(enc.id)}
                  onToggleSelect={() => toggleId(enc.id)}
                  onUpdate={updated => setEditEncounters(prev => prev.map(e => e.id === enc.id ? updated : e))}
                  colorScheme="green"
                  replaceMode={replaceIds.has(enc.id)}
                  onToggleReplace={() => toggleReplaceId(enc.id)}
                  summaryContent={
                    <div className="flex flex-col gap-0.5">
                      {enc.description && (
                        <span className="italic opacity-75 line-clamp-1">{enc.description}</span>
                      )}
                      {matchedAdvNames.length > 0 && <div>⚔ {matchedAdvNames.join(', ')}</div>}
                      {matchedEnvNames.length > 0 && <div>🗺 {matchedEnvNames.join(', ')}</div>}
                      {matchedAdvNames.length === 0 && matchedEnvNames.length === 0 && !enc.description && (
                        <span className="italic opacity-75">No matched elements</span>
                      )}
                    </div>
                  }
                />
              );
            }}
          />

          <ImportPreviewSummary summaryParts={summaryParts} />
        </div>
      )}

      {step === 'success' && (
        <ImportSuccessStep
          importedItems={importedItems}
          onImportSuccess={onImportSuccess}
          onClose={onClose}
          colorScheme="green"
        />
      )}
    </ImportModalShell>
  );
}
