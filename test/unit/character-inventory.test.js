import { describe, it, expect } from 'vitest';
import {
  normalizeInventoryList,
  addInventoryEntry,
  addInventoryEntries,
  removeInventoryEntry,
  updateInventoryEntryQuantity,
  updateInventoryEntryName,
  isLibraryLinkedInventoryEntry,
} from '../../src/client/lib/character-inventory.js';

describe('normalizeInventoryList', () => {
  it('assigns uid to legacy rows and defaults quantity to 1', () => {
    const [row] = normalizeInventoryList([{ name: 'Rope' }]);
    expect(row.name).toBe('Rope');
    expect(row.quantity).toBe(1);
    expect(typeof row.uid).toBe('string');
    expect(row.uid.length).toBeGreaterThan(0);
  });

  it('keeps existing uid, id, and a valid refCollection', () => {
    const [row] = normalizeInventoryList([{
      uid: 'keep-me',
      name: 'Relic',
      quantity: 2,
      id: 'srd-itm-relic',
      refCollection: 'items',
    }]);
    expect(row).toEqual({
      uid: 'keep-me',
      name: 'Relic',
      quantity: 2,
      id: 'srd-itm-relic',
      refCollection: 'items',
    });
  });

  it('drops invalid entries and unknown refCollection', () => {
    const rows = normalizeInventoryList([
      null,
      'nope',
      { name: 'Torch', quantity: 0, refCollection: 'scenes' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Torch');
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].refCollection).toBeUndefined();
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeInventoryList(null)).toEqual([]);
    expect(normalizeInventoryList(undefined)).toEqual([]);
  });
});

describe('inventory mutations', () => {
  it('addInventoryEntry appends a new row and does not merge by name', () => {
    const first = addInventoryEntry([], { name: 'Potion', quantity: 1 });
    const next = addInventoryEntry(first, { name: 'Potion', quantity: 1 });
    expect(next).toHaveLength(2);
    expect(next[0].uid).not.toBe(next[1].uid);
    expect(next.every((r) => r.name === 'Potion')).toBe(true);
  });

  it('addInventoryEntries appends a batch as separate rows', () => {
    const next = addInventoryEntries([{ uid: 'keep', name: 'Rope' }], [
      { name: 'Torch', quantity: 3 },
      { name: 'Potion', quantity: 1, id: 'srd-con-potion', refCollection: 'consumables' },
    ]);
    expect(next).toHaveLength(3);
    expect(next[0]).toMatchObject({ uid: 'keep', name: 'Rope' });
    expect(next[1]).toMatchObject({ name: 'Torch', quantity: 3 });
    expect(next[2]).toMatchObject({ name: 'Potion', quantity: 1, id: 'srd-con-potion', refCollection: 'consumables' });
  });

  it('removeInventoryEntry drops only the matching uid', () => {
    const list = normalizeInventoryList([
      { uid: 'a', name: 'A' },
      { uid: 'b', name: 'B' },
    ]);
    expect(removeInventoryEntry(list, 'a').map((r) => r.uid)).toEqual(['b']);
  });

  it('updateInventoryEntryQuantity and Name target by uid', () => {
    const list = normalizeInventoryList([
      { uid: 'a', name: 'A', quantity: 1 },
      { uid: 'b', name: 'B', quantity: 1 },
    ]);
    expect(updateInventoryEntryQuantity(list, 'b', 4).find((r) => r.uid === 'b').quantity).toBe(4);
    expect(updateInventoryEntryName(list, 'a', 'Ale').find((r) => r.uid === 'a').name).toBe('Ale');
  });
});

describe('isLibraryLinkedInventoryEntry', () => {
  it('is true only when id is a non-empty string', () => {
    expect(isLibraryLinkedInventoryEntry({ id: 'srd-itm-x', name: 'X' })).toBe(true);
    expect(isLibraryLinkedInventoryEntry({ name: 'Free text' })).toBe(false);
    expect(isLibraryLinkedInventoryEntry(null)).toBe(false);
  });
});
