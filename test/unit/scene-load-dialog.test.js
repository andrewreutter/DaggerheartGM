import { describe, it, expect } from 'vitest';
import {
  shouldOfferReplaceOrAdd,
  sceneHasActiveBattleMods,
  buildSceneSnapshotTableOp,
  normalizeNextScenes,
} from '../../src/client/lib/scene-load-dialog.js';

describe('shouldOfferReplaceOrAdd', () => {
  it('is true only for scenes', () => {
    expect(shouldOfferReplaceOrAdd('scenes')).toBe(true);
    expect(shouldOfferReplaceOrAdd('adversaries')).toBe(false);
    expect(shouldOfferReplaceOrAdd('environments')).toBe(false);
    expect(shouldOfferReplaceOrAdd('characters')).toBe(false);
  });
});

describe('sceneHasActiveBattleMods', () => {
  it('reads tableBattleMods or battleMods', () => {
    expect(sceneHasActiveBattleMods({ tableBattleMods: { moreDangerous: true } })).toBe(true);
    expect(sceneHasActiveBattleMods({ battleMods: { lessDifficult: true } })).toBe(true);
    expect(sceneHasActiveBattleMods({ tableBattleMods: { moreDangerous: false } })).toBe(false);
    expect(sceneHasActiveBattleMods({})).toBe(false);
    expect(sceneHasActiveBattleMods(null)).toBe(false);
  });
});

describe('normalizeNextScenes', () => {
  it('returns [] for missing or invalid values', () => {
    expect(normalizeNextScenes(undefined)).toEqual([]);
    expect(normalizeNextScenes(null)).toEqual([]);
    expect(normalizeNextScenes('grove')).toEqual([]);
    expect(normalizeNextScenes({})).toEqual([]);
  });

  it('keeps { id, name }, drops empties and duplicate ids, and accepts bare id strings', () => {
    expect(normalizeNextScenes([
      { id: 'srd-scene-grove', name: 'Abandoned Grove' },
      { id: '  ', name: 'Nope' },
      { id: 'srd-scene-grove', name: 'Duplicate' },
      'srd-scene-keep',
      { id: 'srd-scene-keep', name: 'Keep' },
      null,
    ])).toEqual([
      { id: 'srd-scene-grove', name: 'Abandoned Grove' },
      { id: 'srd-scene-keep', name: 'srd-scene-keep' },
    ]);
  });
});

describe('buildSceneSnapshotTableOp', () => {
  const remapped = {
    maps: [{ id: 'm1' }],
    mapViews: [{ id: 'v1', mapId: 'm1' }],
    elements: [{ instanceId: 'e1', elementType: 'adversary' }],
    sessionCountdowns: [{ id: 'cd1' }],
  };

  it('builds add-scene-snapshot without battle mods by default', () => {
    const op = buildSceneSnapshotTableOp({ mode: 'add', remapped, scene: { tableBattleMods: { moreDangerous: true } } });
    expect(op.op).toBe('add-scene-snapshot');
    expect(op.maps).toEqual(remapped.maps);
    expect(op.elements).toEqual(remapped.elements);
    expect(op.nextScenes).toEqual([]);
    expect(op).not.toHaveProperty('tableBattleMods');
  });

  it('always copies normalized nextScenes from the scene, including an empty list', () => {
    const withNext = buildSceneSnapshotTableOp({
      mode: 'add',
      remapped,
      scene: { nextScenes: [{ id: 'srd-scene-b', name: 'B' }, { id: 'srd-scene-b', name: 'Dup' }] },
    });
    expect(withNext.nextScenes).toEqual([{ id: 'srd-scene-b', name: 'B' }]);

    const empty = buildSceneSnapshotTableOp({ mode: 'replace', remapped, scene: {} });
    expect(empty.nextScenes).toEqual([]);
  });

  it('never copies scene partySize or partyTier onto the table op', () => {
    const op = buildSceneSnapshotTableOp({
      mode: 'add',
      remapped,
      applySceneBattleMods: true,
      scene: { partySize: 6, partyTier: 3, tableBattleMods: { moreDangerous: true } },
    });
    expect(op).not.toHaveProperty('partySize');
    expect(op).not.toHaveProperty('partyTier');
    expect(op.tableBattleMods).toEqual({ moreDangerous: true });
  });

  it('builds replace-scene-snapshot and copies mods when applySceneBattleMods is set', () => {
    const mods = { moreDangerous: true };
    const op = buildSceneSnapshotTableOp({
      mode: 'replace',
      remapped,
      applySceneBattleMods: true,
      scene: { tableBattleMods: mods },
    });
    expect(op.op).toBe('replace-scene-snapshot');
    expect(op.tableBattleMods).toEqual(mods);
    expect(op.tableBattleMods).not.toBe(mods);
  });
});
