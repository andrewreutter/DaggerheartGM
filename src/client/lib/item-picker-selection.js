/**
 * Multi-select basket for Encounter / Scene ItemPickerModal.
 * Selected items live as footer chips (not pinned into search results).
 */

export const PICKER_COUNT_MIN = 1;
export const PICKER_COUNT_MAX = 20;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampPickerCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < PICKER_COUNT_MIN) return PICKER_COUNT_MIN;
  return Math.min(PICKER_COUNT_MAX, n);
}

/**
 * @param {Array<{ item: object, count: number }>} selected
 * @param {object} item
 * @param {{ defaultCount?: number }} [opts]
 * @returns {Array<{ item: object, count: number }>}
 */
export function togglePickerSelection(selected, item, { defaultCount = 1 } = {}) {
  const id = item?.id;
  if (id == null) return selected || [];
  const list = selected || [];
  const idx = list.findIndex((row) => row.item?.id === id);
  if (idx >= 0) return list.filter((_, i) => i !== idx);
  return [...list, { item, count: clampPickerCount(defaultCount) }];
}

/**
 * @param {Array<{ item: object, count: number }>} selected
 * @param {string} id
 * @param {unknown} count
 * @returns {Array<{ item: object, count: number }>}
 */
export function setPickerSelectionCount(selected, id, count) {
  const next = clampPickerCount(count);
  return (selected || []).map((row) => (row.item?.id === id ? { ...row, count: next } : row));
}

