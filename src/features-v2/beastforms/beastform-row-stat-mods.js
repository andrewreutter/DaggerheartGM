/**
 * Parse SRD strings like `"Agility +1"` or `"Evasion +2"` (same shape as client `parseBeastformBonus`).
 * @returns {{ stat: string, bonus: number } | null}
 */
export function parseBeastformStatBonus(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().match(/^(\w+)\s*([+-]\d+)$/i);
  if (!m) return null;
  return { stat: m[1].toLowerCase(), bonus: parseInt(m[2], 10) };
}

/**
 * Row-level beastform bonuses as {@link applyDeclarativeFeatures} `stats` keys.
 * Attached to each beastform registry row as `passiveStatMods` (once per source via `_sourceScopeKey`).
 *
 * @param {object} row — SRD beastform row (`trait_bonus`, `evasion_bonus` strings)
 * @returns {Record<string, number> | null}
 */
export function passiveStatModsFromBeastformRow(row) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  const tb = parseBeastformStatBonus(row.trait_bonus);
  if (tb && tb.stat !== 'evasion') {
    out[tb.stat] = tb.bonus;
  }
  const eb = parseBeastformStatBonus(row.evasion_bonus);
  if (eb?.stat === 'evasion') {
    out.evasion = eb.bonus;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * SRD `advantages` field — comma-separated keywords (e.g. `"deceive, locate, sneak"`) —
 * into {@link applyDeclarativeFeatures} / pre-roll `advantageTriggers` strings.
 *
 * @param {object} row — SRD beastform row (`advantages` string)
 * @returns {string[] | null}
 */
export function advantageTriggersFromBeastformRow(row) {
  if (!row || typeof row !== 'object') return null;
  const raw = row.advantages;
  if (raw == null || raw === '') return null;
  const str = typeof raw === 'string' ? raw : String(raw);
  const parts = str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return parts.map((k) => `rolls to ${k}`);
}
