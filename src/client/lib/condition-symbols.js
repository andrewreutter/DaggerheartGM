import { normalizeConditionsToList } from './conditions-utils.js';

/**
 * Text glyphs for condition marks. Assigned by condition name (case-insensitive),
 * not by position on a character, so the same condition shares one icon everywhere.
 * The palette still starts with `*`.
 */
export const CONDITION_SYMBOLS = [
  '*',
  '†',
  '‡',
  '§',
  '¶',
  '※',
  '#',
  '@',
  '%',
  '&',
  '+',
  '×',
  '÷',
  '◊',
  '★',
  '✦',
];

/**
 * @param {number} index
 * @returns {string}
 */
export function conditionSymbolAtIndex(index) {
  const i = Number(index);
  if (!Number.isFinite(i) || i < 0) return CONDITION_SYMBOLS[0];
  return CONDITION_SYMBOLS[Math.floor(i) % CONDITION_SYMBOLS.length];
}

/**
 * FNV-1a of the trimmed lowercase name — stable across tokens, chips, and dropdowns.
 * @param {unknown} name
 * @returns {number}
 */
function hashConditionName(name) {
  const s = String(name ?? '').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Glyph for a condition name. Empty/whitespace falls back to `*`.
 * @param {unknown} name
 * @returns {string}
 */
export function conditionSymbolForName(name) {
  const s = String(name ?? '').trim();
  if (!s) return CONDITION_SYMBOLS[0];
  return conditionSymbolAtIndex(hashConditionName(s) % CONDITION_SYMBOLS.length);
}

/**
 * Pair each applied condition with the glyph used on its token, editor chip, and dropdown.
 * @param {unknown} conditions
 * @returns {{ name: string, symbol: string, index: number }[]}
 */
export function conditionMarks(conditions) {
  return normalizeConditionsToList(conditions).map((name, index) => ({
    name,
    symbol: conditionSymbolForName(name),
    index,
  }));
}
