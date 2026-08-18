import { describe, it, expect } from 'vitest';
import {
  libraryInventorySelectionKey,
  toggleLibraryInventorySelection,
  addCustomInventorySelection,
  removeInventorySelection,
  setInventorySelectionCount,
  inventorySelectionTotalCount,
  inventorySelectionToEntries,
} from '../../src/client/lib/inventory-item-picker.js';
import { PICKER_COUNT_MAX } from '../../src/client/lib/item-picker-selection.js';

const rope = { id: 'srd-itm-rope', name: 'Rope' };
const potion = { id: 'srd-con-potion', name: 'Healing Potion' };

describe('toggleLibraryInventorySelection', () => {
  it('adds then removes by tab:id and keeps other rows', () => {
    const once = toggleLibraryInventorySelection([], 'items', rope);
    expect(once).toEqual([{
      key: libraryInventorySelectionKey('items', rope.id),
      tab: 'items',
      item: rope,
      count: 1,
      custom: false,
    }]);
    const withPotion = toggleLibraryInventorySelection(once, 'consumables', potion, { defaultCount: 3 });
    expect(withPotion).toHaveLength(2);
    expect(withPotion[1].count).toBe(3);
    expect(toggleLibraryInventorySelection(withPotion, 'items', rope).map((r) => r.item.id)).toEqual([potion.id]);
  });

  it('ignores items without an id', () => {
    expect(toggleLibraryInventorySelection([], 'items', { name: 'Nope' })).toEqual([]);
  });
});

describe('custom inventory selection', () => {
  it('appends a new chip even when the name already exists', () => {
    const once = addCustomInventorySelection([], 'Torch', { key: 'custom:a' });
    const twice = addCustomInventorySelection(once, 'Torch', { key: 'custom:b', count: 2 });
    expect(twice).toHaveLength(2);
    expect(twice[1]).toMatchObject({ key: 'custom:b', count: 2, custom: true, item: { name: 'Torch' } });
  });

  it('ignores blank names', () => {
    expect(addCustomInventorySelection([], '   ')).toEqual([]);
  });

  it('removeInventorySelection drops only the matching key', () => {
    const selected = addCustomInventorySelection(
      toggleLibraryInventorySelection([], 'items', rope),
      'Torch',
      { key: 'custom:a' },
    );
    expect(removeInventorySelection(selected, 'custom:a').map((r) => r.key)).toEqual([
      libraryInventorySelectionKey('items', rope.id),
    ]);
  });
});

describe('setInventorySelectionCount', () => {
  it('updates one row and clamps to the picker range', () => {
    const selected = toggleLibraryInventorySelection([], 'items', rope);
    expect(setInventorySelectionCount(selected, selected[0].key, 5)[0].count).toBe(5);
    expect(setInventorySelectionCount(selected, selected[0].key, 0)[0].count).toBe(1);
    expect(setInventorySelectionCount(selected, selected[0].key, 99)[0].count).toBe(PICKER_COUNT_MAX);
  });
});

describe('inventorySelectionToEntries', () => {
  it('maps library and custom chips to inventory entries with quantities', () => {
    let selected = toggleLibraryInventorySelection([], 'items', rope);
    selected = setInventorySelectionCount(selected, selected[0].key, 4);
    selected = addCustomInventorySelection(selected, 'Lucky Coin', { key: 'custom:a', count: 2 });
    const entries = inventorySelectionToEntries(selected, { generateId: () => 'uid-fixed' });
    expect(entries).toEqual([
      { uid: 'uid-fixed', name: 'Rope', quantity: 4, id: 'srd-itm-rope', refCollection: 'items' },
      { uid: 'uid-fixed', name: 'Lucky Coin', quantity: 2 },
    ]);
    expect(inventorySelectionTotalCount(selected)).toBe(6);
  });
});
