/**
 * Unit tests for src/client/lib/scene-table-adapter.js
 */
import { describe, it, expect } from 'vitest';
import {
  applyScenePartySizeChange,
  applySceneTableOp,
  buildSceneElementFromLibraryItem,
  applyScenePartyTierChange,
  normalizeScenePartySize,
  normalizeScenePartyTier,
  normalizeSceneTableData,
  scenePartySizeOptions,
  scenePartyTierOptions,
  DEFAULT_SCENE_BATTLE_MODS,
  DEFAULT_SCENE_PARTY_SIZE,
  DEFAULT_SCENE_PARTY_TIER,
} from '../../src/client/lib/scene-table-adapter.js';
import { buildMinionGroupElements } from '../../src/client/lib/party-scaled-adversaries.js';

describe('normalizeScenePartySize', () => {
  it('defaults missing or invalid values to 4', () => {
    expect(normalizeScenePartySize(undefined)).toBe(DEFAULT_SCENE_PARTY_SIZE);
    expect(normalizeScenePartySize(null)).toBe(4);
    expect(normalizeScenePartySize('')).toBe(4);
    expect(normalizeScenePartySize('nope')).toBe(4);
  });

  it('clamps to 1–8 and floors fractions', () => {
    expect(normalizeScenePartySize(0)).toBe(1);
    expect(normalizeScenePartySize(-3)).toBe(1);
    expect(normalizeScenePartySize(3.9)).toBe(3);
    expect(normalizeScenePartySize(8)).toBe(8);
    expect(normalizeScenePartySize(12)).toBe(8);
  });
});

describe('scenePartySizeOptions', () => {
  it('lists 1 PC through 8 PCs', () => {
    const opts = scenePartySizeOptions();
    expect(opts[0]).toEqual({ value: 1, label: '1 PC' });
    expect(opts[3]).toEqual({ value: 4, label: '4 PCs' });
    expect(opts).toHaveLength(8);
  });
});

describe('normalizeScenePartyTier', () => {
  it('defaults missing or invalid values to 1', () => {
    expect(normalizeScenePartyTier(undefined)).toBe(DEFAULT_SCENE_PARTY_TIER);
    expect(normalizeScenePartyTier(null)).toBe(1);
    expect(normalizeScenePartyTier('')).toBe(1);
    expect(normalizeScenePartyTier('nope')).toBe(1);
  });

  it('clamps to 1–4 and floors fractions', () => {
    expect(normalizeScenePartyTier(0)).toBe(1);
    expect(normalizeScenePartyTier(-1)).toBe(1);
    expect(normalizeScenePartyTier(2.9)).toBe(2);
    expect(normalizeScenePartyTier(4)).toBe(4);
    expect(normalizeScenePartyTier(9)).toBe(4);
  });
});

describe('scenePartyTierOptions', () => {
  it('lists Tier 1 through Tier 4', () => {
    expect(scenePartyTierOptions()).toEqual([
      { value: 1, label: 'Tier 1' },
      { value: 2, label: 'Tier 2' },
      { value: 3, label: 'Tier 3' },
      { value: 4, label: 'Tier 4' },
    ]);
  });
});

describe('normalizeSceneTableData', () => {
  it('fills maps, activeElements, and tableBattleMods', () => {
    const scene = normalizeSceneTableData({ name: 'Ambush' });
    expect(scene.name).toBe('Ambush');
    expect(Array.isArray(scene.maps)).toBe(true);
    expect(scene.maps.length).toBeGreaterThanOrEqual(1);
    expect(scene.activeElements).toEqual([]);
    expect(scene.tableBattleMods).toMatchObject(DEFAULT_SCENE_BATTLE_MODS);
    expect(scene.partySize).toBe(4);
    expect(scene.partyTier).toBe(1);
    expect(scene.mapConfig).toBeTruthy();
  });

  it('keeps a stored partySize and does not resize existing minion groups', () => {
    const group = buildMinionGroupElements(
      { name: 'Goblin', role: 'minion', hp_max: 1 },
      { groupId: 'g1', count: 2 },
    );
    const scene = normalizeSceneTableData({ partySize: 6, activeElements: group });
    expect(scene.partySize).toBe(6);
    expect(scene.activeElements).toHaveLength(2);
  });
});

describe('applyScenePartySizeChange', () => {
  it('grows and shrinks minion groups to the new designed party size', () => {
    const group = buildMinionGroupElements(
      { name: 'Goblin', role: 'minion', hp_max: 1 },
      { groupId: 'g1', count: 4 },
    );
    const grown = applyScenePartySizeChange({ partySize: 4, activeElements: group }, 6);
    expect(grown.partySize).toBe(6);
    expect(grown.activeElements.filter((el) => el.minionGroupId === 'g1')).toHaveLength(6);

    const shrunk = applyScenePartySizeChange(grown, 3);
    expect(shrunk.partySize).toBe(3);
    expect(shrunk.activeElements.filter((el) => el.minionGroupId === 'g1')).toHaveLength(3);
  });

  it('is a no-op when the size is unchanged', () => {
    const scene = { partySize: 4, activeElements: [] };
    const next = applyScenePartySizeChange(scene, 4);
    expect(next.partySize).toBe(4);
    expect(next.activeElements).toEqual([]);
  });
});

describe('applyScenePartyTierChange', () => {
  it('updates partyTier without touching elements', () => {
    const els = [{ instanceId: 'a1', elementType: 'adversary', name: 'Bear' }];
    const next = applyScenePartyTierChange({ partyTier: 1, activeElements: els }, 3);
    expect(next.partyTier).toBe(3);
    expect(next.activeElements).toEqual(els);
  });

  it('is a no-op when the tier is unchanged', () => {
    const next = applyScenePartyTierChange({ partyTier: 2, activeElements: [] }, 2);
    expect(next.partyTier).toBe(2);
  });
});

describe('applySceneTableOp', () => {
  it('adds an adversary via add-elements', () => {
    const el = {
      instanceId: 'adv-1',
      elementType: 'adversary',
      name: 'Goblin',
      role: 'minion',
      tier: 1,
    };
    const next = applySceneTableOp({ name: 'S' }, { op: 'add-elements', elements: [el] });
    expect(next.activeElements).toHaveLength(1);
    expect(next.activeElements[0].name).toBe('Goblin');
    expect(next.name).toBe('S');
  });

  it('writes tableBattleMods via set-battle-mods', () => {
    const next = applySceneTableOp(
      {},
      { op: 'set-battle-mods', tableBattleMods: { ...DEFAULT_SCENE_BATTLE_MODS, moreDangerous: true } },
    );
    expect(next.tableBattleMods.moreDangerous).toBe(true);
  });

  it('updates a note name and body via update-element', () => {
    const scene = {
      activeElements: [
        { instanceId: 'n1', elementType: 'note', name: 'Note', body: '' },
      ],
    };
    const next = applySceneTableOp(scene, {
      op: 'update-element',
      instanceId: 'n1',
      updates: { name: 'Clue', body: 'Look behind the altar' },
    });
    expect(next.activeElements).toHaveLength(1);
    expect(next.activeElements[0].name).toBe('Clue');
    expect(next.activeElements[0].body).toBe('Look behind the altar');
  });

  it('adds a map via add-map', () => {
    const base = normalizeSceneTableData({});
    const next = applySceneTableOp(base, { op: 'add-map', mapImageUrl: 'https://example.com/map.png' });
    expect(next.maps.length).toBe(base.maps.length + 1);
    expect(next.maps.some((m) => m.mapImageUrl === 'https://example.com/map.png')).toBe(true);
  });
});

describe('buildSceneElementFromLibraryItem', () => {
  it('builds an adversary with runtime tracks', () => {
    const el = buildSceneElementFromLibraryItem(
      { id: 'a1', name: 'Ogre', role: 'bruiser', tier: 2, hp_max: 8 },
      'adversaries',
    );
    expect(el.elementType).toBe('adversary');
    expect(el.instanceId).toBeTruthy();
    expect(el.currentHp).toBe(8);
    expect(el.currentStress).toBe(0);
  });

  it('builds an environment copy', () => {
    const el = buildSceneElementFromLibraryItem({ id: 'e1', name: 'Grove' }, 'environments');
    expect(el.elementType).toBe('environment');
    expect(el.name).toBe('Grove');
  });

  it('builds a note', () => {
    const el = buildSceneElementFromLibraryItem({ name: 'Clue', body: 'Look behind the altar' }, 'notes');
    expect(el.elementType).toBe('note');
    expect(el.name).toBe('Clue');
    expect(el.body).toBe('Look behind the altar');
  });
});
