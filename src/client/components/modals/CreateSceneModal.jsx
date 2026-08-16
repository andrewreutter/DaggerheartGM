import { useEffect, useMemo, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { computeBattlePoints } from '../../lib/battle-points.js';
import { formatPartyScaleNameSuffix } from '../../lib/party-scaled-adversaries.js';
import { normalizeScenePartySize, normalizeScenePartyTier } from '../../lib/scene-table-adapter.js';

const CAPTURE_ELEMENT_TYPES = new Set(['adversary', 'environment', 'note']);
const MAP_DRESSING_TYPES = new Set(['mapImage', 'drawShape']);

function computeTierAndBpFromElements(elements, partySize = 4) {
  const adversaries = (elements || []).filter((el) => el.elementType === 'adversary');
  if (adversaries.length === 0) return { tier: null, bp: 0 };
  const tier = Math.max(...adversaries.map((a) => a.tier ?? 1));
  const bp = computeBattlePoints(
    adversaries.map((a) => ({ role: a.role || 'standard', tier: a.tier ?? 1, count: 1 })),
    partySize,
  );
  return { tier, bp };
}

function toggleSet(set, key, on) {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

function GroupHeader({ title, count, onSelectAll, onSelectNone }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-dh-muted">
        {title}{count != null ? <span className="normal-case tracking-normal font-normal"> ({count})</span> : null}
      </h3>
      {count > 0 && (
        <div className="flex items-center gap-2 text-[11px]">
          <button type="button" tabIndex={0} onClick={onSelectAll} className="text-sky-400/90 hover:text-sky-300">All</button>
          <button type="button" tabIndex={0} onClick={onSelectNone} className="text-dh-muted hover:text-dh">None</button>
        </div>
      )}
    </div>
  );
}

function CheckRow({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-2 py-0.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-red-500"
      />
      <span className="min-w-0">
        <span className="text-sm text-dh block truncate">{label}</span>
        {hint ? <span className="text-[11px] text-dh-muted block truncate">{hint}</span> : null}
      </span>
    </label>
  );
}

export function CreateSceneModal({
  open,
  onClose,
  activeElements = [],
  maps = [],
  mapViews = [],
  sessionCountdowns = [],
  tableBattleMods,
  saveItem,
  navigate,
  partySize = 4,
  partyTier = 1,
}) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMapIds, setSelectedMapIds] = useState(() => new Set());
  const [selectedViewIds, setSelectedViewIds] = useState(() => new Set());
  const [selectedElementIds, setSelectedElementIds] = useState(() => new Set());
  const [selectedCountdownIds, setSelectedCountdownIds] = useState(() => new Set());

  const captureElements = useMemo(
    () => (activeElements || []).filter((el) => CAPTURE_ELEMENT_TYPES.has(el.elementType)),
    [activeElements],
  );
  const environments = useMemo(
    () => captureElements.filter((el) => el.elementType === 'environment'),
    [captureElements],
  );
  const notes = useMemo(
    () => captureElements.filter((el) => el.elementType === 'note'),
    [captureElements],
  );
  const adversaryGroups = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    for (const el of captureElements) {
      if (el.elementType !== 'adversary') continue;
      const key = el.id || el.name || el.instanceId;
      if (!byKey.has(key)) {
        const g = { key, name: el.name || 'Adversary', instances: [] };
        byKey.set(key, g);
        groups.push(g);
      }
      byKey.get(key).instances.push(el);
    }
    return groups;
  }, [captureElements]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setIsPublic(false);
    setSaving(false);
    setSelectedMapIds(new Set((maps || []).map((m) => m.id).filter(Boolean)));
    setSelectedViewIds(new Set((mapViews || []).map((v) => v.id).filter(Boolean)));
    setSelectedElementIds(new Set(captureElements.map((el) => el.instanceId).filter(Boolean)));
    setSelectedCountdownIds(new Set((sessionCountdowns || []).map((c) => c.id).filter(Boolean)));
  // Snapshot selection when the modal opens; ignore later table churn while editing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const mapIdSet = selectedMapIds;
      const mapsOut = structuredClone((maps || []).filter((m) => mapIdSet.has(m.id)));
      // A camera whose map wasn't included has nowhere to live — drop it even if it's
      // still marked selected in state (map was unchecked without re-toggling the camera).
      const mapViewsOut = structuredClone(
        (mapViews || []).filter((v) => selectedViewIds.has(v.id) && mapIdSet.has(v.mapId)),
      );
      const elementsOut = [];
      for (const el of activeElements || []) {
        if (MAP_DRESSING_TYPES.has(el.elementType)) {
          if (el.mapId != null && mapIdSet.has(el.mapId)) elementsOut.push(structuredClone(el));
          continue;
        }
        if (!CAPTURE_ELEMENT_TYPES.has(el.elementType)) continue;
        if (!selectedElementIds.has(el.instanceId)) continue;
        const clone = structuredClone(el);
        if (clone.mapId != null && !mapIdSet.has(clone.mapId)) {
          clone.mapId = null;
          clone.tokenX = null;
          clone.tokenY = null;
          if ('viewId' in clone) clone.viewId = null;
        }
        elementsOut.push(clone);
      }
      const countdownsOut = structuredClone(
        (sessionCountdowns || []).filter((c) => selectedCountdownIds.has(c.id)),
      );
      for (const cd of countdownsOut) {
        if (cd.mapId != null && !mapIdSet.has(cd.mapId)) {
          cd.mapId = null;
          if ('viewId' in cd) cd.viewId = null;
        }
      }
      const designedPartySize = normalizeScenePartySize(partySize);
      const designedPartyTier = normalizeScenePartyTier(partyTier);
      const { tier, bp } = computeTierAndBpFromElements(elementsOut, designedPartySize);
      const item = {
        id: generateId(),
        name: name.trim(),
        description: '',
        is_public: !!isPublic,
        maps: mapsOut,
        mapViews: mapViewsOut,
        activeElements: elementsOut,
        sessionCountdowns: countdownsOut,
        tableBattleMods: tableBattleMods ? structuredClone(tableBattleMods) : {},
        partySize: designedPartySize,
        partyTier: designedPartyTier,
        tier,
        bp,
      };
      await saveItem('scenes', item);
      onClose();
      navigate(`/library/scenes/${item.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[53] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[min(40rem,90vh)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-dh flex items-center gap-2">
            <Camera size={18} /> Create Scene
          </h2>
          <button type="button" tabIndex={0} onClick={onClose} className="text-dh-muted hover:text-dh"><X size={18} /></button>
        </div>

        <p className="text-sm text-dh-muted mb-4 shrink-0">
          Save a snapshot of this table as a reusable Scene. Map drawings and images are included with their map.
        </p>

        <label className="block text-sm font-medium text-dh mb-1 shrink-0">Scene Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. Bandit Ambush"
          autoFocus
          className="w-full bg-dh-raised border border-dh-strong rounded-lg px-3 py-2 text-sm text-dh placeholder-dh-muted outline-none focus:border-red-500 mb-3 shrink-0"
        />

        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted mb-4 shrink-0">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-blue-500"
          />
          Public
        </label>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          <section>
            <GroupHeader
              title="Maps"
              count={maps.length}
              onSelectAll={() => setSelectedMapIds(new Set((maps || []).map((m) => m.id).filter(Boolean)))}
              onSelectNone={() => setSelectedMapIds(new Set())}
            />
            {maps.length === 0 ? <p className="text-xs text-dh-muted italic">None</p> : maps.map((m) => {
              const mapChecked = selectedMapIds.has(m.id);
              const viewsForMap = (mapViews || []).filter((v) => v.mapId === m.id);
              return (
                <div key={m.id} className="mb-1.5">
                  <CheckRow
                    checked={mapChecked}
                    onChange={(on) => setSelectedMapIds((prev) => toggleSet(prev, m.id, on))}
                    label={m.name || 'Map'}
                  />
                  {viewsForMap.length > 0 && (
                    <div className="pl-6 space-y-0">
                      {viewsForMap.map((v) => (
                        <label
                          key={v.id}
                          className={`flex items-center gap-2 py-0.5 select-none ${mapChecked ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                          title={mapChecked ? undefined : 'Select the map above to include this camera'}
                        >
                          <input
                            type="checkbox"
                            checked={mapChecked && selectedViewIds.has(v.id)}
                            disabled={!mapChecked}
                            onChange={(e) => setSelectedViewIds((prev) => toggleSet(prev, v.id, e.target.checked))}
                            className="accent-red-500"
                          />
                          <Camera size={11} className="shrink-0 text-dh-muted" />
                          <span className="text-xs text-dh truncate">{v.name || 'View'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <GroupHeader
              title="Environments"
              count={environments.length}
              onSelectAll={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                environments.forEach((el) => next.add(el.instanceId));
                return next;
              })}
              onSelectNone={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                environments.forEach((el) => next.delete(el.instanceId));
                return next;
              })}
            />
            {environments.length === 0 ? <p className="text-xs text-dh-muted italic">None</p> : environments.map((el) => (
              <CheckRow
                key={el.instanceId}
                checked={selectedElementIds.has(el.instanceId)}
                onChange={(on) => setSelectedElementIds((prev) => toggleSet(prev, el.instanceId, on))}
                label={el.name || 'Environment'}
              />
            ))}
          </section>

          <section>
            <GroupHeader
              title="Adversaries"
              count={adversaryGroups.reduce((n, g) => n + g.instances.length, 0)}
              onSelectAll={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                adversaryGroups.forEach((g) => g.instances.forEach((el) => next.add(el.instanceId)));
                return next;
              })}
              onSelectNone={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                adversaryGroups.forEach((g) => g.instances.forEach((el) => next.delete(el.instanceId)));
                return next;
              })}
            />
            {adversaryGroups.length === 0 ? <p className="text-xs text-dh-muted italic">None</p> : adversaryGroups.map((g) => (
              <div key={g.key} className="mb-1">
                {g.instances.length === 1 ? (
                  <CheckRow
                    checked={selectedElementIds.has(g.instances[0].instanceId)}
                    onChange={(on) => setSelectedElementIds((prev) => toggleSet(prev, g.instances[0].instanceId, on))}
                    label={`${g.name}${formatPartyScaleNameSuffix(g.instances[0])}`}
                  />
                ) : (
                  <>
                    <p className="text-xs font-medium text-dh mb-0.5">{g.name}</p>
                    <div className="pl-3">
                      {g.instances.map((el, idx) => (
                        <CheckRow
                          key={el.instanceId}
                          checked={selectedElementIds.has(el.instanceId)}
                          onChange={(on) => setSelectedElementIds((prev) => toggleSet(prev, el.instanceId, on))}
                          label={`${g.name} #${idx + 1}${formatPartyScaleNameSuffix(el)}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>

          <section>
            <GroupHeader
              title="Notes"
              count={notes.length}
              onSelectAll={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                notes.forEach((el) => next.add(el.instanceId));
                return next;
              })}
              onSelectNone={() => setSelectedElementIds((prev) => {
                const next = new Set(prev);
                notes.forEach((el) => next.delete(el.instanceId));
                return next;
              })}
            />
            {notes.length === 0 ? <p className="text-xs text-dh-muted italic">None</p> : notes.map((el) => (
              <CheckRow
                key={el.instanceId}
                checked={selectedElementIds.has(el.instanceId)}
                onChange={(on) => setSelectedElementIds((prev) => toggleSet(prev, el.instanceId, on))}
                label={el.name || 'Note'}
              />
            ))}
          </section>

          <section>
            <GroupHeader
              title="Countdowns"
              count={sessionCountdowns.length}
              onSelectAll={() => setSelectedCountdownIds(new Set((sessionCountdowns || []).map((c) => c.id).filter(Boolean)))}
              onSelectNone={() => setSelectedCountdownIds(new Set())}
            />
            {sessionCountdowns.length === 0 ? <p className="text-xs text-dh-muted italic">None</p> : sessionCountdowns.map((c) => (
              <CheckRow
                key={c.id}
                checked={selectedCountdownIds.has(c.id)}
                onChange={(on) => setSelectedCountdownIds((prev) => toggleSet(prev, c.id, on))}
                label={c.label || 'Countdown'}
              />
            ))}
          </section>
        </div>

        <div className="flex justify-end gap-2 mt-5 shrink-0">
          <button type="button" tabIndex={0} onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-dh-muted hover:text-dh bg-dh-raised border border-dh-strong hover:border-dh-strong transition-colors">Cancel</button>
          <button
            type="button"
            tabIndex={0}
            onClick={() => { void handleSave(); }}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
