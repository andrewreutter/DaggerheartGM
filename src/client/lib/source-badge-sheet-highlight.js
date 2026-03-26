/**
 * When the user hovers a character sheet title “source” badge (class, subclass, ancestry, etc.),
 * feature cards and action chips not tied to that source are dimmed. Pure helpers — no React.
 */

/**
 * @typedef {null | {
 *   kind: 'class' | 'subclass' | 'ancestry' | 'community' | 'domain' | 'pronouns' | 'incomplete' | 'library';
 *   name?: string;
 * }} SheetSourceHighlight
 */

/**
 * Hovering these badges does not filter the sheet (no dimming).
 * @param {SheetSourceHighlight} h
 */
export function isNeutralSheetHighlight(h) {
  return h == null || h.kind === 'pronouns' || h.kind === 'incomplete' || h.kind === 'library';
}

function scopeKeyMatchesClass(sk, el) {
  const cid = el?.classId;
  if (!sk || !cid) return false;
  return sk === `classes:${cid}` || sk.startsWith(`classes:${cid}:`);
}

function scopeKeyMatchesSubclass(sk, el) {
  const sid = el?.subclassId;
  if (!sk || !sid) return false;
  return sk === `subclasses:${sid}` || sk.startsWith(`subclasses:${sid}:`);
}

function scopeKeyMatchesCommunity(sk, el) {
  const id = el?.communityId;
  if (!sk || !id) return false;
  return sk === `communities:${id}` || sk.startsWith(`communities:${id}:`);
}

/**
 * Whether a guide / registry feature row “belongs” to the hovered badge (do not dim).
 * @param {object} featRow
 * @param {object} el — character element
 * @param {SheetSourceHighlight} highlight
 */
export function sheetHighlightMatchesGuideFeatRow(featRow, el, highlight) {
  if (isNeutralSheetHighlight(highlight)) return true;
  const sk = featRow?._sourceScopeKey;
  const t = featRow?.type;

  switch (highlight.kind) {
    case 'class': {
      if (t === 'class' || t === 'beastform') return true;
      if (t === 'ability' || t === 'subclass' || t === 'ancestry' || t === 'community') return false;
      return scopeKeyMatchesClass(sk, el);
    }
    case 'subclass': {
      if (t === 'subclass') return true;
      return scopeKeyMatchesSubclass(sk, el);
    }
    case 'ancestry': {
      if (t !== 'ancestry') return false;
      if (!highlight.name) return true;
      return featRow.source === highlight.name;
    }
    case 'community': {
      if (t === 'community') return true;
      return scopeKeyMatchesCommunity(sk, el);
    }
    case 'domain': {
      if (t === 'ability') return false;
      return false;
    }
    default:
      return true;
  }
}

/**
 * Domain ability cards — `ability` is one entry from `el.abilities`.
 * @param {object} ability
 * @param {object} el
 * @param {SheetSourceHighlight} highlight
 */
export function sheetHighlightMatchesAbility(ability, el, highlight) {
  if (isNeutralSheetHighlight(highlight)) return true;
  if (highlight.kind !== 'domain') return false;
  return ability?.domain === highlight.name;
}

/**
 * @param {object} featRow
 * @param {object} el
 * @param {SheetSourceHighlight} highlight
 */
export function shouldDimGuideFeatRow(featRow, el, highlight) {
  if (isNeutralSheetHighlight(highlight)) return false;
  return !sheetHighlightMatchesGuideFeatRow(featRow, el, highlight);
}

/**
 * @param {object} ability
 * @param {object} el
 * @param {SheetSourceHighlight} highlight
 */
export function shouldDimAbility(ability, el, highlight) {
  if (isNeutralSheetHighlight(highlight)) return false;
  return !sheetHighlightMatchesAbility(ability, el, highlight);
}

/**
 * @param {object | null} ability — when null, uses guide-only matching
 * @param {object} featRow
 * @param {object} el
 * @param {SheetSourceHighlight} highlight
 */
export function shouldDimFeatOrAbilityRow(ability, featRow, el, highlight) {
  if (isNeutralSheetHighlight(highlight)) return false;
  if (ability && featRow?.type === 'ability') {
    return shouldDimAbility(ability, el, highlight);
  }
  return shouldDimGuideFeatRow(featRow, el, highlight);
}

/** Defined in `src/input.css` as `.dh-sheet-source-dim` so styles always apply (not lost to Tailwind scan). */
export const SHEET_SOURCE_DIM_CLASS = 'dh-sheet-source-dim';
