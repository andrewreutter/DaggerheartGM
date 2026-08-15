import { describe, it, expect } from 'vitest';
import {
  clampPickerCount,
  togglePickerSelection,
  setPickerSelectionCount,
  PICKER_COUNT_MIN,
  PICKER_COUNT_MAX,
} from '../../src/client/lib/item-picker-selection.js';

const goblin = { id: 'adv-1', name: 'Goblin' };
const ogre = { id: 'adv-2', name: 'Ogre' };

describe('clampPickerCount', () => {
  it('floors and clamps to 1–20', () => {
    expect(clampPickerCount(0)).toBe(PICKER_COUNT_MIN);
    expect(clampPickerCount(-3)).toBe(PICKER_COUNT_MIN);
    expect(clampPickerCount('x')).toBe(PICKER_COUNT_MIN);
    expect(clampPickerCount(2.9)).toBe(2);
    expect(clampPickerCount(20)).toBe(PICKER_COUNT_MAX);
    expect(clampPickerCount(99)).toBe(PICKER_COUNT_MAX);
  });
});

describe('togglePickerSelection', () => {
  it('adds then removes by id', () => {
    const once = togglePickerSelection([], goblin);
    expect(once).toEqual([{ item: goblin, count: 1 }]);
    expect(togglePickerSelection(once, goblin)).toEqual([]);
  });

  it('keeps other rows and honors defaultCount', () => {
    const start = [{ item: goblin, count: 2 }];
    const next = togglePickerSelection(start, ogre, { defaultCount: 3 });
    expect(next).toEqual([
      { item: goblin, count: 2 },
      { item: ogre, count: 3 },
    ]);
  });

  it('ignores items without an id', () => {
    expect(togglePickerSelection([], { name: 'Nope' })).toEqual([]);
  });
});

describe('setPickerSelectionCount', () => {
  it('updates one row and clamps', () => {
    const selected = [
      { item: goblin, count: 1 },
      { item: ogre, count: 1 },
    ];
    expect(setPickerSelectionCount(selected, 'adv-1', 5)).toEqual([
      { item: goblin, count: 5 },
      { item: ogre, count: 1 },
    ]);
    expect(setPickerSelectionCount(selected, 'adv-1', 0)[0].count).toBe(1);
  });
});

