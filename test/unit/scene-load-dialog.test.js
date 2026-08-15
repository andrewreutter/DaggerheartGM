import { describe, it, expect } from 'vitest';
import {
  shouldOfferReplaceOrAdd,
  sceneHasActiveBattleMods,
  sceneBattleMods,
  buildSceneSnapshotTableOp,
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
    expect(op).not.toHaveProperty('tableBattleMods');
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
