import { describe, it, expect } from 'vitest';
import {
  collectSceneLibraryCardGroups,
  formatSceneLibraryRowTitle,
  libraryPickerRowMeta,
} from '../../src/client/lib/scene-library-card-contents.js';

describe('formatSceneLibraryRowTitle', () => {
  it('prefixes a count to the left of the title when there are duplicates', () => {
    expect(formatSceneLibraryRowTitle('Dire Wolf', 2)).toBe('2 x Dire Wolf');
  });

  it('returns the title alone when there is only one', () => {
    expect(formatSceneLibraryRowTitle('Bear', 1)).toBe('Bear');
  });
});

describe('libraryPickerRowMeta', () => {
  it('reads Tier and role for adversaries', () => {
    expect(libraryPickerRowMeta({ tier: 1, role: 'minion' })).toEqual({ tier: 1, kind: 'minion' });
  });

  it('reads Tier and type for environments', () => {
    expect(libraryPickerRowMeta({ tier: 2, type: 'exploration' })).toEqual({ tier: 2, kind: 'exploration' });
  });

  it('omits missing decorations', () => {
    expect(libraryPickerRowMeta({ name: 'Secret door' })).toEqual({ tier: null, kind: null });
  });
});

describe('collectSceneLibraryCardGroups', () => {
  it('lists map, environment, adversary, and note rows with picker meta', () => {
    const groups = collectSceneLibraryCardGroups({
      maps: [{ id: 'm1', name: 'Forest Clearing' }, { id: 'm2', name: 'Cave' }],
      activeElements: [
        { elementType: 'environment', name: 'Abandoned Grove', tier: 1, type: 'exploration' },
        { elementType: 'adversary', name: 'Bear', tier: 1, role: 'bruiser' },
        { elementType: 'adversary', name: 'Dire Wolf', tier: 1, role: 'standard' },
        { elementType: 'note', name: 'Secret door' },
      ],
    });
    expect(groups).toEqual([
      {
        key: 'maps',
        label: 'Maps',
        entries: [
          { name: 'Forest Clearing', count: 1, tier: null, kind: null },
          { name: 'Cave', count: 1, tier: null, kind: null },
        ],
      },
      {
        key: 'environments',
        label: 'Environments',
        entries: [{ name: 'Abandoned Grove', count: 1, tier: 1, kind: 'exploration' }],
      },
      {
        key: 'adversaries',
        label: 'Adversaries',
        entries: [
          { name: 'Bear', count: 1, tier: 1, kind: 'bruiser' },
          { name: 'Dire Wolf', count: 1, tier: 1, kind: 'standard' },
        ],
      },
      {
        key: 'notes',
        label: 'Notes',
        entries: [{ name: 'Secret door', count: 1, tier: null, kind: null }],
      },
    ]);
  });

  it('collapses duplicate titles and keeps the first row meta', () => {
    const groups = collectSceneLibraryCardGroups({
      maps: [],
      activeElements: [
        { elementType: 'adversary', name: 'Goblin', tier: 1, role: 'minion' },
        { elementType: 'adversary', name: 'Goblin', tier: 1, role: 'minion' },
        { elementType: 'adversary', name: 'Hobgoblin', tier: 1, role: 'standard' },
        { elementType: 'mapImage', name: 'Placed art' },
      ],
    });
    expect(groups).toEqual([
      {
        key: 'adversaries',
        label: 'Adversaries',
        entries: [
          { name: 'Goblin', count: 2, tier: 1, kind: 'minion' },
          { name: 'Hobgoblin', count: 1, tier: 1, kind: 'standard' },
        ],
      },
    ]);
  });

  it('uses fallback titles when a name is missing', () => {
    const groups = collectSceneLibraryCardGroups({
      maps: [{ id: 'm1' }],
      activeElements: [{ elementType: 'note' }],
    });
    expect(groups).toEqual([
      { key: 'maps', label: 'Maps', entries: [{ name: 'Map', count: 1, tier: null, kind: null }] },
      { key: 'notes', label: 'Notes', entries: [{ name: 'Note', count: 1, tier: null, kind: null }] },
    ]);
  });

  it('returns no groups for an empty or missing scene', () => {
    expect(collectSceneLibraryCardGroups(null)).toEqual([]);
    expect(collectSceneLibraryCardGroups({})).toEqual([]);
  });
});
