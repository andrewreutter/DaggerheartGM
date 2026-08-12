/**
 * Pure helpers for shared per-table conditions suggestion history
 * (`table_state.conditionsHistory`) plus live names currently on the table.
 */

import { normalizeConditionsToList } from './conditions-utils.js';

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

/**
 * Unique condition names currently applied on characters, adversaries, and companions.
 * First-seen casing wins (table order).
 * @param {unknown} activeElements
 * @returns {string[]}
 */
export function collectLiveConditionNames(activeElements) {
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    for (const name of normalizeConditionsToList(raw)) {
      const lower = name.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(name);
    }
  };
  for (const el of Array.isArray(activeElements) ? activeElements : []) {
    const type = el?.elementType;
    if (type === 'character' || type === 'adversary') add(el.conditions);
    if (type === 'character' && el.companion) add(el.companion.conditions);
  }
  return out;
}

/**
 * History (MRU) first, then any live names not already present (case-insensitive).
 * @param {unknown} history
 * @param {unknown} live
 * @returns {string[]}
 */
export function mergeConditionSuggestionLists(history, live) {
  const seen = new Set();
  const out = [];
  for (const raw of [...(Array.isArray(history) ? history : []), ...(Array.isArray(live) ? live : [])]) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(s);
  }
  return out;
}
