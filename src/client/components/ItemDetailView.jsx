import { useState, useMemo } from 'react';
import { X, Copy, Edit, Trash2, BookCopy, Globe, Lock } from 'lucide-react';
import { generateRolzExport } from '../lib/rolz-export.js';
import { generateId } from '../lib/helpers.js';
import { EnvironmentCardContent, AdversaryCardContent } from './DetailCardContent.jsx';

const SOURCE_BADGE = {
  srd: { label: 'SRD', className: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
  public: { label: 'Public', className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
};

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
                <EnvironmentCardContent element={el} hoveredFeature={hoveredFeature} cardKey={cardKey} />
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
  );
}

export function ItemDetailView({ item, tab, data, onEdit, onDelete, onClone, onClose, onSavePublic }) {
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
          <ExpandedTablePreview item={item} tab={tab} data={data} />
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
