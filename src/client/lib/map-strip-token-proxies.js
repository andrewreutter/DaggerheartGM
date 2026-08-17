/**
 * Map/camera strip token chips: collapse same-type adversaries so the thumb shows
 * `LAx2` instead of two `LA` markers. Characters and companion board tokens stay
 * one chip each (same grouping key as Encounter: library `id`).
 */

/**
 * @param {{ kind?: string, typeId?: string, name?: string, key?: string, defeated?: boolean }} token
 * @returns {string}
 */
export function thumbAdversaryGroupKey(token) {
  return token?.typeId || token?.name || token?.key || '';
}

/**
 * Chip label: `LA` for a single token, `LAx2` when several of that adversary type are in view.
 *
 * @param {{ abbrev?: string, count?: number }|null|undefined} token
 * @returns {string}
 */
export function formatThumbTokenProxyLabel(token) {
  const abbrev = token?.abbrev || '?';
  const count = token?.count ?? 1;
  return count > 1 ? `${abbrev}x${count}` : abbrev;
}

/**
 * Collapse consecutive-or-scattered same-type adversary chips. Living + defeated copies of
 * the same type share one chip; the chip is defeated only when every instance is defeated.
 *
 * @param {Array<{ kind?: string, typeId?: string, name?: string, key?: string, abbrev?: string, defeated?: boolean }>|null|undefined} tokens
 * @returns {Array<object>}
 */
export function collapseThumbViewportTokenProxies(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  const out = [];
  const advIndexByType = new Map();
  for (const t of tokens) {
    if (t.kind !== 'adversary') {
      out.push({ ...t, count: 1 });
      continue;
    }
    const typeKey = thumbAdversaryGroupKey(t);
    const existingIdx = advIndexByType.get(typeKey);
    if (existingIdx == null) {
      advIndexByType.set(typeKey, out.length);
      out.push({ ...t, count: 1 });
      continue;
    }
    const prev = out[existingIdx];
    out[existingIdx] = {
      ...prev,
      count: prev.count + 1,
      defeated: !!(prev.defeated && t.defeated),
    };
  }
  return out;
}
