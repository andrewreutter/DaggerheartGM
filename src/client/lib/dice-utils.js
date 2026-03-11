/**
 * Shared dice-result parsing and damage-rewriting utilities used by both
 * React components and the feature IoC files (which can't import from
 * component modules).
 */

/**
 * Parse a sub-item details string into an array of numeric die values.
 * Details strings come in two shapes:
 *   "3+4+5"       → keep-all multi-die result
 *   "2,3->5"      → keep-highest: discarded=[2,3], kept=5
 * Returns `{ all: number[], discarded: number[] }`.
 */
export function parseSubDetails(details) {
  if (!details) return { all: null, discarded: [] };
  const s = String(details).replace(/[()[\]\s]/g, '');
  if (s.includes('->')) {
    const arrowIdx = s.lastIndexOf('->');
    const keptStr = s.slice(arrowIdx + 2);
    const discardedStr = s.slice(0, arrowIdx);
    const kept = parseInt(keptStr, 10);
    const discarded = discardedStr
      ? discardedStr.split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n))
      : [];
    if (!isNaN(kept)) return { all: [...discarded, kept], discarded };
  }
  const parts = s.split('+').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
  if (parts.length > 0) return { all: parts, discarded: [] };
  return { all: null, discarded: [] };
}

/**
 * Extract all numeric die values from a details string.
 * Returns `[]` when details is absent or unparseable.
 */
export function extractDetailsValues(details) {
  const { all } = parseSubDetails(details);
  return all || [];
}

// ── Damage string rewriting ────────────────────────────────────────────────

/**
 * Add a numeric bonus to the modifier of a damage dice expression.
 * e.g. `rewriteDamageWithBonus('d8+2 phy', 3)` → `'d8+5 phy'`
 */
export function rewriteDamageWithBonus(damageStr, bonus) {
  if (!bonus || !damageStr) return damageStr;
  const m = damageStr.trim().match(/^(\d*d\d+)([+-]\d+)?(.*)$/i);
  if (!m) return damageStr;
  const dice = m[1];
  const existing = m[2] ? parseInt(m[2], 10) : 0;
  const newMod = existing + bonus;
  const suffix = m[3] || '';
  const modStr = newMod > 0 ? `+${newMod}` : newMod < 0 ? `${newMod}` : '';
  return `${dice}${modStr}${suffix}`;
}

/**
 * Rewrite a damage string using a dice-system extension notation.
 * Handles: Powerful/Massive (2dXkh), Brutal (dX!), Self-Correcting (dXm6),
 * Serrated (dXm8).
 */
export function rewriteDamageForFeature(damageStr, featureName) {
  if (!damageStr || !featureName) return damageStr;
  const m = damageStr.trim().match(/^(\d*)(d\d+)([+-]\d+)?(.*)$/i);
  if (!m) return damageStr;
  const qty    = m[1] || '1';
  const die    = m[2];
  const modStr = m[3] || '';
  const rest   = m[4] || '';
  switch (featureName) {
    case 'Powerful':
    case 'Massive':
      return `2${die}kh${modStr}${rest}`;
    case 'Brutal':
      return `${qty}${die}!${modStr}${rest}`;
    case 'Self-Correcting':
      return `${qty}${die}m6${modStr}${rest}`;
    case 'Serrated':
      return `${qty}${die}m8${modStr}${rest}`;
    default:
      return damageStr;
  }
}
