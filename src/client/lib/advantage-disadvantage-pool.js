/**
 * Own-pool advantage / disadvantage cancel + keep-highest.
 *
 * A PC’s own d6 advantage and disadvantage names cancel one-for-one (FIFO).
 * Leftover dice of one type are rolled keep-highest and added (advantage) or
 * subtracted (disadvantage). Help an Ally / Tag Team `addDie` helper dice stay
 * outside this pool and still sum.
 */

import { splitHelpAllySuffix } from './help-an-ally.js';

/** Own-pool die: `[d6]`, `[1d6]`, or `[Nd6kh]` (N ≥ 2). Not bare `[2d6]` damage. */
const OWN_POOL_DIE_RE = /\[(?:(\d+)d6kh|1d6|d6)\]/i;
const TRAILING_OWN_POOL_DIE_RE = /\[(?:(\d+)d6kh|1d6|d6)\]\s*$/i;
const TRAILING_DISADVANTAGE_RE = /\s+disadvantage\s+([^\[]+?)\s*\[(?:\d+d6kh|1d6|d6)\]\s*$/i;
const TRAILING_CANCELLED_RE = /\s+—\s+cancelled:\s+.+$/i;

/** Range / trait / damage-type tokens that sit before a trailing own-pool label. */
const LEADING_ROLL_NOISE_RE = /^(?:very\s+close|very\s+far|melee|close|far|phy|mag|agility|strength|finesse|instinct|presence|knowledge)\s+/i;

/**
 * @param {unknown} label
 * @returns {string[]}
 */
export function splitOwnPoolNames(label) {
  return String(label || '')
    .split(/\s+and\s+/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function joinOwnPoolNames(names) {
  return names.filter(Boolean).join(' and ');
}

/**
 * @param {{ advantageNames?: string[], disadvantageNames?: string[] }} [input]
 * @returns {{
 *   cancelled: { advantage: string, disadvantage: string }[],
 *   remainingType: 'advantage' | 'disadvantage' | null,
 *   remainingNames: string[],
 * }}
 */
export function resolveOwnPool(input = {}) {
  const advantageNames = (input.advantageNames || []).map((n) => String(n || '').trim()).filter(Boolean);
  const disadvantageNames = (input.disadvantageNames || []).map((n) => String(n || '').trim()).filter(Boolean);
  const cancelled = [];
  const n = Math.min(advantageNames.length, disadvantageNames.length);
  for (let i = 0; i < n; i++) {
    cancelled.push({ advantage: advantageNames[i], disadvantage: disadvantageNames[i] });
  }
  const remainingAdv = advantageNames.slice(n);
  const remainingDis = disadvantageNames.slice(n);
  if (remainingAdv.length > 0) {
    return { cancelled, remainingType: 'advantage', remainingNames: remainingAdv };
  }
  if (remainingDis.length > 0) {
    return { cancelled, remainingType: 'disadvantage', remainingNames: remainingDis };
  }
  return { cancelled, remainingType: null, remainingNames: [] };
}

/**
 * Die-block suffix only (no cancelled note).
 * Advantage: ` Aim [d6]` / ` Aim and Dueling [2d6kh]`
 * Disadvantage: ` disadvantage Retract [1d6]` / ` disadvantage Retract and Cover [2d6kh]`
 *
 * @param {{ remainingType: 'advantage' | 'disadvantage' | null, remainingNames: string[] }} resolved
 * @returns {string}
 */
export function formatOwnPoolDieSuffix(resolved) {
  const names = resolved?.remainingNames || [];
  if (!resolved?.remainingType || names.length === 0) return '';
  const label = joinOwnPoolNames(names);
  if (resolved.remainingType === 'advantage') {
    const die = names.length === 1 ? '[d6]' : `[${names.length}d6kh]`;
    return ` ${label} ${die}`;
  }
  const die = names.length === 1 ? '[1d6]' : `[${names.length}d6kh]`;
  return ` disadvantage ${label} ${die}`;
}

/**
 * @param {{ cancelled?: { advantage: string, disadvantage: string }[] }} resolved
 * @returns {string}
 */
export function formatOwnPoolCancelledNote(resolved) {
  const cancelled = resolved?.cancelled || [];
  if (cancelled.length === 0) return '';
  const pairs = cancelled.map((c) => `${c.advantage} vs ${c.disadvantage}`).join(', ');
  return ` — cancelled: ${pairs}`;
}

/**
 * Own-pool roll suffix: leftover die block plus optional ` — cancelled: A vs B`.
 *
 * @param {ReturnType<typeof resolveOwnPool>} resolved
 * @param {{ includeCancelled?: boolean }} [opts]
 * @returns {string}
 */
export function formatOwnPoolRollSuffix(resolved, opts = {}) {
  const includeCancelled = opts.includeCancelled !== false;
  return formatOwnPoolDieSuffix(resolved) + (includeCancelled ? formatOwnPoolCancelledNote(resolved) : '');
}

function stripLeadingRollNoise(label) {
  let s = String(label || '').trim();
  while (s && LEADING_ROLL_NOISE_RE.test(s)) {
    s = s.replace(LEADING_ROLL_NOISE_RE, '').trim();
  }
  return s;
}

/**
 * Pull trailing own-pool advantage / disadvantage blocks off roll text so they can
 * be re-resolved (cancel + keep-highest) instead of stacking a second pool.
 * Helper names+dice are stripped first when `extra.helps` is set (or a leftover
 * ` — help:` prefix is present) so they are not treated as own-pool advantage.
 *
 * @param {string} rollText
 * @param {{ helps?: object[] }} [extra]
 * @returns {{ strippedText: string, advantageNames: string[], disadvantageNames: string[], helpSuffix: string }}
 */
export function extractOwnPoolFromRollText(rollText, extra = {}) {
  if (!rollText || typeof rollText !== 'string') {
    return { strippedText: rollText, advantageNames: [], disadvantageNames: [], helpSuffix: '' };
  }
  const advantageNames = [];
  const disadvantageNames = [];
  const { text: withoutHelp, helpSuffix } = splitHelpAllySuffix(rollText, extra.helps);
  let s = (typeof withoutHelp === 'string' ? withoutHelp : rollText).trimEnd();

  const cancelled = s.match(TRAILING_CANCELLED_RE);
  if (cancelled) {
    s = s.slice(0, -cancelled[0].length).trimEnd();
  }

  let m;
  while ((m = s.match(TRAILING_DISADVANTAGE_RE))) {
    const names = splitOwnPoolNames(m[1]);
    for (let i = names.length - 1; i >= 0; i--) disadvantageNames.unshift(names[i]);
    s = s.slice(0, -m[0].length).trimEnd();
  }

  if (TRAILING_OWN_POOL_DIE_RE.test(s) && !/\bdisadvantage\s+[^\[]+$/i.test(s.replace(TRAILING_OWN_POOL_DIE_RE, ''))) {
    const dieMatch = s.match(TRAILING_OWN_POOL_DIE_RE);
    const dieStart = s.length - dieMatch[0].length;
    const beforeDie = s.slice(0, dieStart).trimEnd();
    const lastBound = Math.max(beforeDie.lastIndexOf(']'), beforeDie.lastIndexOf('}'));
    const prefix = lastBound === -1 ? '' : beforeDie.slice(0, lastBound + 1).trimEnd();
    const afterBound = (lastBound === -1 ? beforeDie : beforeDie.slice(lastBound + 1)).trim();
    const label = stripLeadingRollNoise(afterBound);
    if (label && !/^disadvantage\b/i.test(label)) {
      advantageNames.push(...splitOwnPoolNames(label));
      const noise = afterBound.slice(0, Math.max(0, afterBound.length - label.length)).trim();
      s = noise ? `${prefix} ${noise}`.trim() : prefix;
    }
  }

  return { strippedText: s, advantageNames, disadvantageNames, helpSuffix };
}

/**
 * Merge extra own-pool names into roll text (extract existing pool first so a
 * second `[d6]` / `[Nd6kh]` block is never emitted).
 *
 * @param {string} rollText
 * @param {{ advantageNames?: string[], disadvantageNames?: string[], includeCancelled?: boolean, helps?: object[] }} [extra]
 * @returns {string}
 */
export function applyOwnPoolToRollText(rollText, extra = {}) {
  const extracted = extractOwnPoolFromRollText(rollText, extra);
  const resolved = resolveOwnPool({
    advantageNames: [...extracted.advantageNames, ...(extra.advantageNames || [])],
    disadvantageNames: [...extracted.disadvantageNames, ...(extra.disadvantageNames || [])],
  });
  const includeCancelled = extra.includeCancelled !== false;
  return extracted.strippedText
    + formatOwnPoolDieSuffix(resolved)
    + (includeCancelled ? formatOwnPoolCancelledNote(resolved) : '')
    + (extracted.helpSuffix || '');
}

/**
 * @param {string} rollText
 * @param {string} name
 * @returns {string}
 */
export function appendOwnPoolAdvantageToRollText(rollText, name) {
  const label = String(name || '').trim();
  if (!label) return rollText;
  return applyOwnPoolToRollText(rollText, { advantageNames: [label] });
}

/**
 * @param {string} rollText
 * @param {string} name
 * @returns {string}
 */
export function appendOwnPoolDisadvantageToRollText(rollText, name) {
  const label = String(name || '').trim();
  if (!label) return rollText;
  return applyOwnPoolToRollText(rollText, { disadvantageNames: [label] });
}

/**
 * Apply V2 intent mutations that feed the own pool onto a client roll wrapper.
 * Helper `addDie` mutations are intentionally ignored.
 *
 * @param {object[]} mutations
 * @param {{ addAdvantageDie?: Function, addDisadvantage?: Function, addDisadvantageDie?: Function, removeDisadvantage?: Function }} rollWrapper
 */
export function applyOwnPoolDieMutations(mutations, rollWrapper) {
  if (!Array.isArray(mutations) || !rollWrapper) return;
  for (const m of mutations) {
    const name = m?.payload?.name;
    if (m?.type === 'addAdvantageDie' && name) {
      rollWrapper.addAdvantageDie?.(name);
    } else if (m?.type === 'addDisadvantageDie' && name) {
      (rollWrapper.addDisadvantageDie || rollWrapper.addDisadvantage)?.(name);
    } else if (m?.type === 'removeDisadvantageDie') {
      rollWrapper.removeDisadvantage?.();
    }
  }
}

export { OWN_POOL_DIE_RE };
