/**
 * Whether the library card/modal chrome should show the tier shield next to the item name.
 * Excludes characters (tier is surfaced on the sheet, not the hex shield).
 *
 * @param {string} collection
 * @param {object} [item]
 * @returns {boolean}
 */
export function showLibraryTierShield(collection, item) {
  if (collection === 'characters') return false;
  if (item == null) return false;
  const t = item.tier;
  if (t === undefined || t === null || t === '') return false;
  return true;
}

/**
 * Single-line tier caption matching Library adversary card copy (Tier + role/type/extras).
 *
 * @param {object} item
 * @param {string} collection
 * @returns {string}
 */
export function libraryTierSubtitleText(item, collection) {
  if (item == null || item.tier === undefined || item.tier === null || item.tier === '') return '';
  const t = item.tier;
  switch (collection) {
    case 'adversaries':
      return item.role ? `Tier ${t} ${item.role}` : `Tier ${t}`;
    case 'environments':
      return item.type ? `Tier ${t} ${item.type}` : `Tier ${t}`;
    case 'weapons':
      return `Tier ${t} · ${item.primary_or_secondary || '—'} · ${item.physical_or_magical || '—'}`;
    case 'armor':
    case 'beastforms':
      return `Tier ${t}`;
    default:
      if (item.role) return `Tier ${t} ${item.role}`;
      if (item.type) return `Tier ${t} ${item.type}`;
      return `Tier ${t}`;
  }
}

/**
 * Subtitle line for detail body when the tier shield sits on the title — avoids repeating "Tier N".
 *
 * @param {object} item
 * @param {string} collection
 * @returns {string}
 */
export function libraryTierBodyLine(item, collection) {
  const full = libraryTierSubtitleText(item, collection);
  if (!full) return '';
  return full
    .replace(/^Tier\s+[\d?]+\s*/, '')
    .replace(/^\s*·\s*/, '')
    .trim();
}
