/**
 * Persisted "saved dice rolls" for the Action Log manual dice builder — user-named presets
 * capturing the Duality toggle, per-size dice counts, and flat modifier so a GM/player can
 * re-roll them with a single click. Stored in localStorage; this is a browser-level UI
 * convenience (like `dh_featureExpanded`), not game state, so it is not synced via table ops.
 */

const STORAGE_KEY = 'dh_savedDiceRolls_v1';

/** @typedef {{ id: string, name: string, dualityOn: boolean, counts: Record<number, number>, modifier: number }} SavedDiceRoll */

function isValidSavedDiceRoll(v) {
  return (
    v && typeof v === 'object'
    && typeof v.id === 'string'
    && typeof v.name === 'string'
    && typeof v.dualityOn === 'boolean'
    && v.counts && typeof v.counts === 'object'
    && typeof v.modifier === 'number'
  );
}

function makeSavedDiceRollId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* ignore */ }
  return `sdr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @returns {SavedDiceRoll[]} */
export function readSavedDiceRolls() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidSavedDiceRoll) : [];
  } catch {
    return [];
  }
}

function writeSavedDiceRolls(rolls) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rolls));
  } catch {
    /* ignore (e.g. private browsing storage quota) */
  }
}

/**
 * Builds a new saved-roll entry from the given name and current builder state. Pure —
 * does not touch localStorage. Use with `persistSavedDiceRolls` to write the result.
 * @returns {SavedDiceRoll}
 */
export function buildSavedDiceRoll(name, { dualityOn, counts, modifier }) {
  return {
    id: makeSavedDiceRollId(),
    name: (name || '').trim() || 'Roll',
    dualityOn: !!dualityOn,
    counts: { ...counts },
    modifier: Number(modifier) || 0,
  };
}

/** Appends `entry` to `existing` and persists the result. @returns {SavedDiceRoll[]} */
export function addSavedDiceRoll(existing, entry) {
  const next = [...existing, entry];
  writeSavedDiceRolls(next);
  return next;
}

/** Removes the saved roll with the given id and persists the result. @returns {SavedDiceRoll[]} */
export function removeSavedDiceRoll(existing, id) {
  const next = existing.filter((r) => r.id !== id);
  writeSavedDiceRolls(next);
  return next;
}
