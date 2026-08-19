/**
 * Shared dice-result parsing and damage-rewriting utilities used by both
 * React components and the feature IoC files (which can't import from
 * component modules).
 */

/**
 * Parse NdS[kh|kl][!][mN][+/-M] notation (same grammar as server `rollDice`).
 * @param {string | null | undefined} input
 * @returns {{ qty: number, sides: number, keep: string | null, exploding: boolean, minimum: number | null, modifier: number } | null}
 */
export function parseDiceExpr(input) {
  if (!input) return null;
  const m = /^(\d*)d(\d+)(kh|kl)?(!)?(?:m(\d+))?([+-]\d+)?$/i.exec(String(input).trim());
  if (!m) return null;
  return {
    qty: parseInt(m[1] || '1', 10),
    sides: parseInt(m[2], 10),
    keep: (m[3] || '').toLowerCase() || null,
    exploding: !!m[4],
    minimum: m[5] ? parseInt(m[5], 10) : null,
    modifier: m[6] ? parseInt(m[6], 10) : 0,
  };
}

/**
 * Maximum value of the dice in an expression, excluding the numeric modifier.
 * `2d8+5` → 16. Explosions are ignored (unbounded). Keep-highest still counts
 * every die in the notation (`2d8kh` → 16).
 * @param {string | null | undefined} input
 * @returns {number}
 */
export function maxDamageDiceValue(input) {
  const parsed = parseDiceExpr(input);
  if (!parsed || parsed.qty < 1 || parsed.sides < 2) return 0;
  return parsed.qty * parsed.sides;
}

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
 * Parse the leading dice expression from a damage string.
 * Returns `{ qty, die, modStr, rest }` or `null` if the string doesn't match.
 * e.g. `parseLeadingDamageDice('d8+2 phy')` → `{ qty: '1', die: 'd8', modStr: '+2', rest: ' phy' }`
 * e.g. `parseLeadingDamageDice('2d6')` → `{ qty: '2', die: 'd6', modStr: '', rest: '' }`
 */
export function parseLeadingDamageDice(damageStr) {
  if (!damageStr) return null;
  const m = damageStr.trim().match(/^(\d*)(d\d+)([+-]\d+)?(.*)$/i);
  if (!m) return null;
  return {
    qty: m[1] || '1',
    die: m[2],
    modStr: m[3] || '',
    rest: m[4] || '',
  };
}

/**
 * Append " disadvantage <featureName> [1d6]" to the end of roll text (same pattern as advantage dice).
 * The server rolls 1d6 and subtracts it from the action total; the banner shows the feature name (e.g. Retract).
 * @param {string} rollText
 * @param {string} [featureName] - e.g. 'Galapa - Retract'; used in roll text and banner label
 * @returns {string}
 */
export function insertDisadvantageD6(rollText, featureName = 'disadvantage') {
  if (!rollText || typeof rollText !== 'string') return rollText;
  const label = (featureName || 'disadvantage').trim() || 'disadvantage';
  return rollText.trimEnd() + ` disadvantage ${label} [1d6]`;
}

/**
 * Strip trailing " disadvantage <label> [Nd6]" / "[Nd6kh]" blocks from roll text
 * (inverse of insertDisadvantageD6 and the own-pool keep-highest suffix).
 * Used by removeDisadvantage() so features like Goblin Surefooted can ignore disadvantage.
 * @param {string} rollText
 * @returns {{ strippedText: string, removedLabels: string[] }}
 */
export function stripDisadvantageFromRollText(rollText) {
  if (!rollText || typeof rollText !== 'string') return { strippedText: rollText, removedLabels: [] };
  const removedLabels = [];
  let s = rollText.trimEnd();
  // One or more trailing " disadvantage <label> [1d6]" / "[2d6kh]" (label may contain spaces)
  const re = /\s+disadvantage\s+([^\[]+?)\s*\[\d*d\d+(?:kh|kl)?\]\s*$/i;
  let m;
  while ((m = s.match(re))) {
    removedLabels.unshift(m[1].trim() || 'Disadvantage');
    s = s.slice(0, -m[0].length).trimEnd();
  }
  return { strippedText: s, removedLabels };
}
