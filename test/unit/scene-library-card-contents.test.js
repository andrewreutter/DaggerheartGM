import { describe, it, expect } from 'vitest';
import {
  collectSceneLibraryCardGroups,
  formatSceneLibraryBpLabel,
  formatSceneLibraryRowTitle,
  libraryPickerRowMeta,
  sceneLibraryBpRange,
  sceneMapPreviewAspectRatio,
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

describe('formatSceneLibraryBpLabel', () => {
  it('uses designed party size when no N+ adversaries are present', () => {
    const scene = {
      partySize: 4,
      activeElements: [
        { elementType: 'adversary', role: 'bruiser', tier: 1 },
      ],
    };
    expect(sceneLibraryBpRange(scene)).toEqual({ pcMin: 4, pcMax: null, bpMin: 4, bpMax: 4 });
    expect(formatSceneLibraryBpLabel(scene)).toBe('4 BP for 4 PCs');
  });

  it('singularizes 1 PC when the scene is designed for one character', () => {
    const scene = {
      partySize: 1,
      activeElements: [
        { elementType: 'adversary', role: 'standard', tier: 1 },
      ],
    };
    expect(formatSceneLibraryBpLabel(scene)).toBe('2 BP for 1 PC');
  });

  it('defaults missing party size to 4 and still labels an empty scene', () => {
    expect(formatSceneLibraryBpLabel({ activeElements: [] })).toBe('0 BP for 4 PCs');
  });

  it('spans 1 under the smallest N+ through the largest N+ (4+ and 7+ → 3-7)', () => {
    const scene = {
      partySize: 4,
      activeElements: [
        { elementType: 'adversary', role: 'standard', tier: 1 },
        { elementType: 'adversary', role: 'solo', tier: 3, minPartySize: 4 },
        { elementType: 'adversary', role: 'solo', tier: 3, minPartySize: 7 },
      ],
    };
    // At 3 PCs: standard only (2). At 7 PCs: standard + both solos (2+5+5=12).
    expect(sceneLibraryBpRange(scene)).toEqual({ pcMin: 3, pcMax: 7, bpMin: 2, bpMax: 12 });
    expect(formatSceneLibraryBpLabel(scene)).toBe('2-12 BP for 3-7 PCs');
  });

  it('uses a single 4+ adversary as a 3-4 PC span', () => {
    const scene = {
      partySize: 5,
      activeElements: [
        { elementType: 'adversary', role: 'standard', tier: 1 },
        { elementType: 'adversary', role: 'bruiser', tier: 1, minPartySize: 4 },
      ],
    };
    expect(sceneLibraryBpRange(scene)).toEqual({ pcMin: 3, pcMax: 4, bpMin: 2, bpMax: 6 });
    expect(formatSceneLibraryBpLabel(scene)).toBe('2-6 BP for 3-4 PCs');
  });

  it('ignores Always (minPartySize ≤ 1) and environment N+ tags', () => {
    const scene = {
      partySize: 4,
      activeElements: [
        { elementType: 'adversary', role: 'standard', tier: 1, minPartySize: 1 },
        { elementType: 'environment', name: 'Grove', minPartySize: 5 },
      ],
    };
    expect(formatSceneLibraryBpLabel(scene)).toBe('2 BP for 4 PCs');
  });

  it('returns empty for a missing scene', () => {
    expect(formatSceneLibraryBpLabel(null)).toBe('');
    expect(formatSceneLibraryBpLabel(undefined)).toBe('');
  });
});

describe('sceneMapPreviewAspectRatio', () => {
  it('returns a CSS aspect-ratio from stored natural pixels', () => {
    expect(sceneMapPreviewAspectRatio({ mapImageNaturalWidth: 1600, mapImageNaturalHeight: 900 })).toBe('1600 / 900');
  });

  it('omits a ratio when natural size is missing or invalid', () => {
    expect(sceneMapPreviewAspectRatio(null)).toBeUndefined();
    expect(sceneMapPreviewAspectRatio({})).toBeUndefined();
    expect(sceneMapPreviewAspectRatio({ mapImageNaturalWidth: 0, mapImageNaturalHeight: 900 })).toBeUndefined();
  });
});
