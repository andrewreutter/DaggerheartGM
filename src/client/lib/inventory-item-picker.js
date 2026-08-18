import { generateId } from './generate-id.js';
import { clampPickerCount } from './item-picker-selection.js';
import { INVENTORY_REF_COLLECTIONS } from './character-inventory.js';

/**
 * Multi-select basket for InventoryItemPickerModal.
 * Library rows key on `tab:id`; custom rows get a unique key per add.
 */

export function libraryInventorySelectionKey(tab, itemId) {
  return `${tab}:${itemId}`;
}

/**
 * @param {Array<object>} selected
 * @param {string} tab
 * @param {object} item
 * @param {{ defaultCount?: number }} [opts]
 * @returns {Array<object>}
 */
export function toggleLibraryInventorySelection(selected, tab, item, { defaultCount = 1 } = {}) {
  const id = item?.id;
  if (id == null || !tab) return selected || [];
  const key = libraryInventorySelectionKey(tab, id);
  const list = selected || [];
  const idx = list.findIndex((row) => row.key === key);
  if (idx >= 0) return list.filter((_, i) => i !== idx);
  return [...list, {
    key,
    tab,
    item,
    count: clampPickerCount(defaultCount),
    custom: false,
  }];
}

/**
 * Always appends a new custom chip (does not merge by name).
 * @param {Array<object>} selected
 * @param {string} name
 * @param {{ count?: number, key?: string }} [opts]
 * @returns {Array<object>}
 */
export function addCustomInventorySelection(selected, name, { count = 1, key } = {}) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return selected || [];
  return [...(selected || []), {
    key: key || `custom:${generateId()}`,
    tab: 'custom',
    item: { name: trimmed },
    count: clampPickerCount(count),
    custom: true,
  }];
}

/**
 * @param {Array<object>} selected
 * @param {string} key
 * @returns {Array<object>}
 */
export function removeInventorySelection(selected, key) {
  return (selected || []).filter((row) => row.key !== key);
}

/**
 * @param {Array<object>} selected
 * @param {string} key
 * @param {unknown} count
 * @returns {Array<object>}
 */
export function setInventorySelectionCount(selected, key, count) {
  const next = clampPickerCount(count);
  return (selected || []).map((row) => (row.key === key ? { ...row, count: next } : row));
}

/**
 * @param {Array<object>} selected
 * @returns {number}
 */
export function inventorySelectionTotalCount(selected) {
  return (selected || []).reduce((sum, row) => sum + (row.count || 1), 0);
}

/**
 * @param {Array<object>} selected
 * @param {{ generateId?: () => string }} [opts]
 * @returns {Array<{ uid: string, name: string, quantity: number, id?: string, refCollection?: string }>}
 */
export function inventorySelectionToEntries(selected, { generateId: genId = generateId } = {}) {
  const out = [];
  for (const row of selected || []) {
    const name = typeof row.item?.name === 'string' ? row.item.name.trim() : '';
    if (!name) continue;
    const entry = {
      uid: genId(),
      name,
      quantity: clampPickerCount(row.count),
    };
    if (!row.custom && typeof row.item?.id === 'string' && row.item.id) {
      entry.id = row.item.id;
      if (INVENTORY_REF_COLLECTIONS.includes(row.tab)) {
        entry.refCollection = row.tab;
      }
    }
    out.push(entry);
  }
  return out;
}
