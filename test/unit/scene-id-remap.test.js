import { describe, it, expect } from 'vitest';
import { regenerateSceneIdsForTablePlacement } from '../../src/client/lib/scene-id-remap.js';

function makeSceneData() {
  return {
    maps: [
      { id: 'map-old-1', name: 'Forest', mapImageUrl: 'https://cdn.example/forest.png?v=1' },
      { id: 'map-old-2', name: 'Cave', mapImageUrl: 'https://cdn.example/cave.png' },
    ],
    mapViews: [
      { id: 'view-old-1', name: 'Wide', mapId: 'map-old-1' },
      { id: 'view-old-2', name: 'Close', mapId: 'map-old-2' },
    ],
    activeElements: [
      { instanceId: 'el-adv-1', elementType: 'adversary', name: 'Goblin', mapId: 'map-old-1', viewId: 'view-old-1' },
      { instanceId: 'el-env-1', elementType: 'environment', name: 'Grove', mapId: 'map-old-2', viewId: 'view-old-2' },
      { instanceId: 'el-unplaced', elementType: 'adversary', name: 'Wolf', mapId: null },
      { instanceId: 'el-minion-1', elementType: 'adversary', name: 'Rat', minionGroupId: 'group-old' },
      { instanceId: 'el-minion-2', elementType: 'adversary', name: 'Rat', minionGroupId: 'group-old' },
      {
        instanceId: 'el-shape-1',
        elementType: 'drawShape',
        mapId: 'map-old-1',
        viewId: 'view-old-1',
        pointsFt: [{ x: 1, y: 2 }],
      },
    ],
    sessionCountdowns: [
      { id: 'cd-old-1', label: 'Collapse', mapId: 'map-old-2', viewId: 'view-old-2', sourceRef: { elementInstanceId: 'el-adv-1', cardKey: 'a', featureKey: 'f', cdIdx: 0 } },
    ],
  };
}

function collectIds(result) {
  const ids = [];
  for (const m of result.maps) ids.push(m.id);
  for (const v of result.mapViews) ids.push(v.id);
  for (const el of result.elements) ids.push(el.instanceId);
  for (const cd of result.sessionCountdowns) ids.push(cd.id);
  return ids;
}

describe('regenerateSceneIdsForTablePlacement', () => {
  it('assigns fresh ids on every call, with no collisions across two placements of the same scene', () => {
    const sceneData = makeSceneData();
    const inputIds = [
      'map-old-1', 'map-old-2', 'view-old-1', 'view-old-2',
      'el-adv-1', 'el-env-1', 'el-unplaced', 'el-minion-1', 'el-minion-2', 'el-shape-1', 'cd-old-1',
    ];
    const a = regenerateSceneIdsForTablePlacement(sceneData);
    const b = regenerateSceneIdsForTablePlacement(sceneData);
    const aIds = collectIds(a);
    const bIds = collectIds(b);

    expect(aIds).toHaveLength(inputIds.length);
    expect(bIds).toHaveLength(inputIds.length);
    for (const id of aIds) {
      expect(inputIds).not.toContain(id);
    }
    for (const id of bIds) {
      expect(inputIds).not.toContain(id);
      expect(aIds).not.toContain(id);
    }
  });

  it('rewrites mapId/viewId cross-references to the new ids', () => {
    const sceneData = makeSceneData();
    const out = regenerateSceneIdsForTablePlacement(sceneData);
    const mapByOld = Object.fromEntries(
      sceneData.maps.map((m, i) => [m.id, out.maps[i].id]),
    );
    const viewByOld = Object.fromEntries(
      sceneData.mapViews.map((v, i) => [v.id, out.mapViews[i].id]),
    );

    expect(out.mapViews[0].mapId).toBe(mapByOld['map-old-1']);
    expect(out.mapViews[1].mapId).toBe(mapByOld['map-old-2']);
    expect(out.elements[0].mapId).toBe(mapByOld['map-old-1']);
    expect(out.elements[0].viewId).toBe(viewByOld['view-old-1']);
    expect(out.elements[1].mapId).toBe(mapByOld['map-old-2']);
    expect(out.elements[1].viewId).toBe(viewByOld['view-old-2']);
    const shape = out.elements.find((el) => el.elementType === 'drawShape');
    expect(shape.mapId).toBe(mapByOld['map-old-1']);
    expect(shape.viewId).toBe(viewByOld['view-old-1']);
    expect(out.sessionCountdowns[0].mapId).toBe(mapByOld['map-old-2']);
    expect(out.sessionCountdowns[0].viewId).toBe(viewByOld['view-old-2']);
    expect(out.sessionCountdowns[0].sourceRef.elementInstanceId).toBe(out.elements[0].instanceId);
  });

  it('deep-clones so mutating an output never mutates the input or a sibling placement', () => {
    const sceneData = makeSceneData();
    const a = regenerateSceneIdsForTablePlacement(sceneData);
    const b = regenerateSceneIdsForTablePlacement(sceneData);

    const aShape = a.elements.find((el) => el.elementType === 'drawShape');
    const bShape = b.elements.find((el) => el.elementType === 'drawShape');
    const inShape = sceneData.activeElements.find((el) => el.elementType === 'drawShape');

    expect(a.maps).not.toBe(sceneData.maps);
    expect(a.maps[0]).not.toBe(sceneData.maps[0]);
    expect(aShape.pointsFt).not.toBe(inShape.pointsFt);
    expect(a.maps).not.toBe(b.maps);
    expect(a.maps[0]).not.toBe(b.maps[0]);
    expect(a.mapViews[0]).not.toBe(b.mapViews[0]);
    expect(aShape).not.toBe(bShape);
    expect(aShape.pointsFt).not.toBe(bShape.pointsFt);
    expect(a.sessionCountdowns[0]).not.toBe(b.sessionCountdowns[0]);
    expect(a.sessionCountdowns[0].sourceRef).not.toBe(b.sessionCountdowns[0].sourceRef);

    a.maps[0].name = 'MUTATED';
    aShape.pointsFt[0].x = 99;
    a.sessionCountdowns[0].label = 'MUTATED';
    expect(sceneData.maps[0].name).toBe('Forest');
    expect(inShape.pointsFt[0].x).toBe(1);
    expect(sceneData.sessionCountdowns[0].label).toBe('Collapse');
    expect(b.maps[0].name).toBe('Forest');
    expect(bShape.pointsFt[0].x).toBe(1);
    expect(b.sessionCountdowns[0].label).toBe('Collapse');
  });

  it('leaves unplaced elements with mapId: null', () => {
    const out = regenerateSceneIdsForTablePlacement(makeSceneData());
    const unplaced = out.elements.find((el) => el.name === 'Wolf');
    expect(unplaced.mapId).toBeNull();
  });

  it('remaps minionGroupId so two placements do not share a group', () => {
    const sceneData = makeSceneData();
    const a = regenerateSceneIdsForTablePlacement(sceneData);
    const b = regenerateSceneIdsForTablePlacement(sceneData);
    const aRats = a.elements.filter((el) => el.name === 'Rat');
    const bRats = b.elements.filter((el) => el.name === 'Rat');
    expect(aRats).toHaveLength(2);
    expect(aRats[0].minionGroupId).toBe(aRats[1].minionGroupId);
    expect(aRats[0].minionGroupId).not.toBe('group-old');
    expect(bRats[0].minionGroupId).toBe(bRats[1].minionGroupId);
    expect(bRats[0].minionGroupId).not.toBe(aRats[0].minionGroupId);
  });

  it('preserves mapImageUrl strings byte-identical', () => {
    const sceneData = makeSceneData();
    const out = regenerateSceneIdsForTablePlacement(sceneData);
    expect(out.maps[0].mapImageUrl).toBe('https://cdn.example/forest.png?v=1');
    expect(out.maps[1].mapImageUrl).toBe('https://cdn.example/cave.png');
    expect(out.maps[0].mapImageUrl).toBe(sceneData.maps[0].mapImageUrl);
  });
});
