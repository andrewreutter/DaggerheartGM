/**
 * Unit tests for src/client/lib/scene-table-adapter.js
 */
import { describe, it, expect } from 'vitest';
import {
  applySceneTableOp,
  buildSceneElementFromLibraryItem,
  normalizeSceneTableData,
  DEFAULT_SCENE_BATTLE_MODS,
} from '../../src/client/lib/scene-table-adapter.js';

describe('normalizeSceneTableData', () => {
  it('fills maps, activeElements, and tableBattleMods', () => {
    const scene = normalizeSceneTableData({ name: 'Ambush' });
    expect(scene.name).toBe('Ambush');
    expect(Array.isArray(scene.maps)).toBe(true);
    expect(scene.maps.length).toBeGreaterThanOrEqual(1);
    expect(scene.activeElements).toEqual([]);
    expect(scene.tableBattleMods).toMatchObject(DEFAULT_SCENE_BATTLE_MODS);
    expect(scene.mapConfig).toBeTruthy();
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
