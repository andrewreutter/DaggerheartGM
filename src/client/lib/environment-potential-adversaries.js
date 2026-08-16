/**
 * Normalize `potential_adversaries` from any legacy or current format
 * into `{ adversaryId?, name }[]`.
 *
 * @param {unknown} raw
 * @returns {Array<{ adversaryId?: string, name?: string }>}
 */
export function normalizePotentialAdversaries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
  }
  return [];
}
