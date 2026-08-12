/**
 * Pure helpers for shared per-table conditions suggestion history
 * (`table_state.conditionsHistory`). No React/DOM dependency.
 */

/**
 * @param {unknown} list
 * @param {unknown} entry
 * @param {number} [max=50]
 * @returns {string[]}
 */
export function addConditionsHistoryEntry(list, entry, max = 50) {
  const trimmed = String(entry ?? '').trim();
  const prev = Array.isArray(list) ? list.map((e) => String(e)) : [];
  if (!trimmed) return [...prev];
  const lower = trimmed.toLowerCase();
  const filtered = prev.filter((e) => e.trim().toLowerCase() !== lower);
  return [trimmed, ...filtered].slice(0, Math.max(0, max));
}

/**
 * @param {unknown} list
 * @param {unknown} entry
 * @returns {string[]}
 */
export function removeConditionsHistoryEntry(list, entry) {
  const prev = Array.isArray(list) ? list.map((e) => String(e)) : [];
  const lower = String(entry ?? '').trim().toLowerCase();
  if (!lower) return [...prev];
  return prev.filter((e) => e.trim().toLowerCase() !== lower);
}

/**
 * @param {unknown} list
 * @param {unknown} query
 * @param {unknown} excludeList
 * @param {number} [max=8]
 * @returns {string[]}
 */
export function filterConditionsSuggestions(list, query, excludeList, max = 8) {
  const q = String(query ?? '').trim().toLowerCase();
  const exclude = new Set(
    (Array.isArray(excludeList) ? excludeList : [])
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean),
  );
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const s = String(entry).trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (exclude.has(lower)) continue;
    if (q && !lower.includes(q)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
