import { useMemo } from 'react';
import { SRD_UNIFIED_COLLECTIONS } from '../../lib/library-filter-config.js';
import { resolveAttachPrimary } from '../../lib/unified-import-resolve.js';

const LIBRARY_PICK_COLLECTIONS = [
  ...SRD_UNIFIED_COLLECTIONS.filter((c) => c !== 'features'),
  'scenes',
  'adventures',
  'characters',
  'notes',
];

/** @type {Record<string, string>} */
export const DESTINATION_OPTION_LABEL = {
  map: 'Map',
  abilities: 'Ability',
  adversaries: 'Adversary',
  ancestries: 'Ancestry',
  armor: 'Armor',
  beastforms: 'Beastform',
  classes: 'Class',
  communities: 'Community',
  consumables: 'Consumable',
  domains: 'Domain',
  environments: 'Environment',
  items: 'Item',
  subclasses: 'Subclass',
  weapons: 'Weapon',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
  notes: 'Note',
};

export function destinationLabelForKey(key) {
  return DESTINATION_OPTION_LABEL[key] || key;
}

/** @param {any} row @param {any[]} [allSliceRows] */
export function sliceTargetSelectValue(row, allSliceRows) {
  if (row.source === 'text') return `coll:${row.libraryCollection}`;
  if (row.imageTarget === 'map') return 'map';
  if (row.imageTarget === 'attach' && row.attachToSliceId) {
    if (allSliceRows?.length) {
      const t = allSliceRows.find((r) => r.id === row.attachToSliceId);
      if (t) {
        const p = resolveAttachPrimary(t, allSliceRows) ?? t;
        return `attach:${p.id}`;
      }
    }
    return `attach:${row.attachToSliceId}`;
  }
  return `new:${row.libraryCollection}`;
}

/**
 * @param {any} row
 * @param {string} value
 * @returns {Record<string, unknown>}
 */
export function patchSliceTargetFromSelect(row, value) {
  const touched = { userPickedSliceTarget: true };
  if (row.source === 'text') {
    const coll = value.startsWith('coll:') ? value.slice(5) : value;
    return { ...touched, libraryCollection: coll };
  }
  if (value === 'map') {
    return { ...touched, imageTarget: 'map', attachToSliceId: null };
  }
  if (value.startsWith('attach:')) {
    const id = value.slice(7);
    return { ...touched, imageTarget: 'attach', attachToSliceId: id || null };
  }
  if (value.startsWith('new:')) {
    const coll = value.slice(4);
    return { ...touched, imageTarget: 'library', libraryCollection: coll, attachToSliceId: null };
  }
  return touched;
}

function attachTargetLabel(o) {
  const name = o.draft?.name;
  const bit = o.draftCollection ? String(o.draftCollection) : 'pending';
  if (name && typeof name === 'string') return `${name} (${bit})`;
  return `${o.id} (${bit})`;
}

/**
 * Shared: destination dropdown + optional "Use as text" + detection hint.
 * Used in import step 2 and in ImageRegionsEditor so choices stay in sync.
 */
export function ImportSliceDestinationControls({
  row,
  allSliceRows,
  isGameTableGm,
  onAddMapWithImage,
  updateSlice,
  textSliceCollectionOptions,
  compact = false,
  /** Called after the user changes the destination select (same row becomes selected in the parent). */
  onTargetPicked,
}) {
  /** One option per logical import target — attach-only rows resolve to their primary so targets are not duplicated. */
  const attachPrimaryTargets = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const o of allSliceRows) {
      if (o.id === row.id) continue;
      const primary = resolveAttachPrimary(o, allSliceRows) ?? o;
      if (!primary?.id || seen.has(primary.id)) continue;
      seen.add(primary.id);
      out.push(primary);
    }
    return out;
  }, [allSliceRows, row.id]);

  const selClass = compact
    ? 'w-full rounded border border-dh-border bg-dh-inset px-1 py-1 text-[10px] text-dh leading-tight'
    : 'w-full rounded border border-dh-border bg-dh-inset px-1 py-1 text-[10px] text-dh leading-tight';

  return (
    <>
      {row.source === 'image' && row.ocrHasText && !row.ocrPending ? (
        <label
          className={`flex items-center gap-1 text-[9px] text-dh-muted leading-tight cursor-pointer ${compact ? 'min-h-[14px]' : ''}`}
        >
          <input
            type="checkbox"
            checked={row.preferTextForParse !== false}
            onChange={(e) => {
              e.stopPropagation();
              updateSlice(row.id, { preferTextForParse: e.target.checked });
              onTargetPicked?.(row.id);
            }}
            className="rounded border-dh-border shrink-0"
          />
          <span>Use as text</span>
        </label>
      ) : row.source === 'image' ? (
        <span className="block min-h-[14px] shrink-0" aria-hidden />
      ) : null}

      <label className="block">
        <span className="sr-only">Import target</span>
        <select
          value={sliceTargetSelectValue(row, allSliceRows)}
          onChange={(e) => {
            updateSlice(row.id, patchSliceTargetFromSelect(row, e.target.value));
            onTargetPicked?.(row.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className={selClass}
        >
          {row.source === 'text' ? (
            <>
              {textSliceCollectionOptions.map((c) => (
                <option key={c} value={`coll:${c}`}>
                  {destinationLabelForKey(c)}
                </option>
              ))}
            </>
          ) : (
            <>
              {isGameTableGm && onAddMapWithImage ? <option value="map">Map</option> : null}
              {attachPrimaryTargets.length ? (
                <optgroup label="Attach to another slice">
                  {attachPrimaryTargets.map((o) => (
                    <option key={o.id} value={`attach:${o.id}`}>
                      {attachTargetLabel(o)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="New library item">
                {LIBRARY_PICK_COLLECTIONS.filter((c) => c !== 'notes' || isGameTableGm).map((c) => (
                  <option key={c} value={`new:${c}`}>
                    {destinationLabelForKey(c)}
                  </option>
                ))}
              </optgroup>
            </>
          )}
        </select>
      </label>

      {row.draftCollection && !row.parseError ? (
        <p className="text-[9px] text-dh-muted leading-tight text-center" title="Auto-detected or resolved type">
          → {destinationLabelForKey(row.draftCollection)}
          {row.draftCollection === 'map' ? '' : ''}
        </p>
      ) : row.parseError ? (
        <p className="text-[9px] text-red-400/90 text-center leading-tight">{row.parseError}</p>
      ) : row.source === 'image' && row.ocrPending ? (
        <p className="text-[9px] text-dh-muted text-center">Detecting…</p>
      ) : (
        <p className="text-[9px] text-dh-muted text-center">Resolving…</p>
      )}
    </>
  );
}

export { LIBRARY_PICK_COLLECTIONS };
