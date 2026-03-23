/**
 * Table element `conditions` are edited as comma-separated free text in the UI.
 * V2 mutations treat them as a logical list. Never use `[...string]` — that splits
 * into per-character entries.
 */

/**
 * @param {unknown} conditions
 * @returns {string[]}
 */
export function normalizeConditionsToList(conditions) {
  if (Array.isArray(conditions)) {
    return conditions.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof conditions === 'string') {
    return conditions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * @param {string[]} list
 * @returns {string}
 */
export function serializeConditionsList(list) {
  return list.join(', ');
}
