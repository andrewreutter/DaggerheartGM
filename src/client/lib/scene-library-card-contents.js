/**
 * Titled scene contents for library / picker cards (names only, no descriptions).
 */

/**
 * CSS `aspect-ratio` for a scene card map preview, from stored natural pixels.
 * @param {object|null|undefined} map
 * @returns {string|undefined}
 */
export function sceneMapPreviewAspectRatio(map) {
  const w = Number(map?.mapImageNaturalWidth);
  const h = Number(map?.mapImageNaturalHeight);
  if (!(w > 0 && h > 0)) return undefined;
  return `${w} / ${h}`;
}

/**
 * Right-side picker decorations: Tier and role/type (e.g. "Tier 1" · "minion").
 * @param {object|null|undefined} item
 * @returns {{ tier: number|string|null, kind: string|null }}
 */
export function libraryPickerRowMeta(item) {
  const hasTier = item?.tier != null && item.tier !== '';
  const rawKind = item?.role || item?.type;
  const kind = rawKind != null && String(rawKind).trim() ? String(rawKind).trim() : null;
  return {
    tier: hasTier ? item.tier : null,
    kind,
  };
}

/**
 * @param {string} name
 * @param {number} count
 * @returns {string}
 */
export function formatSceneLibraryRowTitle(name, count) {
  const title = String(name ?? '').trim();
  if (count > 1) return `${count} x ${title}`;
  return title;
}

/**
 * @param {object} entry
 * @param {string} name
 * @returns {{ name: string, count: number, tier: number|string|null, kind: string|null }}
 */
function entryFromSource(entry, name) {
  const meta = libraryPickerRowMeta(entry);
  return { name, count: 1, tier: meta.tier, kind: meta.kind };
}

/**
 * @param {unknown[]} list
 * @param {(entry: object) => unknown} getName
 * @param {string} fallback
 * @returns {Array<{ name: string, count: number, tier: number|string|null, kind: string|null }>}
 */
function collectEntries(list, getName, fallback) {
  const byName = new Map();
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || typeof entry !== 'object') continue;
    const name = String(getName(entry) ?? '').trim() || fallback;
    const existing = byName.get(name);
    if (existing) existing.count += 1;
    else byName.set(name, entryFromSource(entry, name));
  }
  return [...byName.values()];
}

/**
 * @param {object|null|undefined} item
 * @param {string} elementType
 * @param {string} fallback
 * @returns {Array<{ name: string, count: number, tier: number|string|null, kind: string|null }>}
 */
function collectElementEntries(item, elementType, fallback) {
  const elements = Array.isArray(item?.activeElements) ? item.activeElements : [];
  return collectEntries(
    elements.filter((el) => el?.elementType === elementType),
    (el) => el.name,
    fallback,
  );
}

/**
 * Non-empty groups of scene item rows, first-seen order, duplicates collapsed.
 * @param {object|null|undefined} item
 * @returns {Array<{ key: string, label: string, entries: Array<{ name: string, count: number, tier: number|string|null, kind: string|null }> }>}
 */
export function collectSceneLibraryCardGroups(item) {
  return [
    { key: 'maps', label: 'Maps', entries: collectEntries(item?.maps, (m) => m.name, 'Map') },
    { key: 'environments', label: 'Environments', entries: collectElementEntries(item, 'environment', 'Environment') },
    { key: 'adversaries', label: 'Adversaries', entries: collectElementEntries(item, 'adversary', 'Adversary') },
    { key: 'notes', label: 'Notes', entries: collectElementEntries(item, 'note', 'Note') },
  ].filter((group) => group.entries.length > 0);
}
