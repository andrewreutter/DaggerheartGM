import { generateId } from './generate-id.js';

export const INVENTORY_REF_COLLECTIONS = ['weapons', 'armor', 'items', 'consumables'];

function clampQuantity(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = typeof entry.name === 'string' ? entry.name : '';
  const uid = typeof entry.uid === 'string' && entry.uid ? entry.uid : generateId();
  const out = {
    uid,
    name,
    quantity: clampQuantity(entry.quantity ?? 1),
  };
  if (typeof entry.id === 'string' && entry.id) out.id = entry.id;
  if (typeof entry.refCollection === 'string' && INVENTORY_REF_COLLECTIONS.includes(entry.refCollection)) {
    out.refCollection = entry.refCollection;
  }
  return out;
}

/** Lazily assigns `uid` to legacy rows. Does not merge by name. */
export function normalizeInventoryList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeEntry).filter(Boolean);
}

export function addInventoryEntry(list, entry) {
  const normalized = normalizeInventoryList(list);
  const row = normalizeEntry(entry);
  if (!row) return normalized;
  return [...normalized, row];
}

/** Appends each entry as its own row. Does not merge by name. */
export function addInventoryEntries(list, entries) {
  let next = normalizeInventoryList(list);
  if (!Array.isArray(entries)) return next;
  for (const entry of entries) {
    const row = normalizeEntry(entry);
    if (row) next = [...next, row];
  }
  return next;
}

export function removeInventoryEntry(list, uid) {
  return normalizeInventoryList(list).filter((e) => e.uid !== uid);
}

export function updateInventoryEntryQuantity(list, uid, quantity) {
  const q = clampQuantity(quantity);
  return normalizeInventoryList(list).map((e) => (e.uid === uid ? { ...e, quantity: q } : e));
}

export function updateInventoryEntryName(list, uid, name) {
  const nextName = typeof name === 'string' ? name : String(name ?? '');
  return normalizeInventoryList(list).map((e) => (e.uid === uid ? { ...e, name: nextName } : e));
}

export function isLibraryLinkedInventoryEntry(entry) {
  return !!(entry && typeof entry.id === 'string' && entry.id);
}
