import { describe, it, expect } from 'vitest';
import {
  shouldApplyRemotePlayerMapView,
  personalCameraTargetsUnsharedMap,
  freeMapExploreTargetsUnsharedMap,
  countPlayerMapStripTiles,
} from '../../src/client/lib/map-view-player-sync.js';

describe('map-view-player-sync', () => {
  it('applies remote GM view to the GM client regardless of personal camera id', () => {
    expect(shouldApplyRemotePlayerMapView(false, null)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(false, 'cam-1')).toBe(true);
  });

  it('applies remote view to players only when not viewing a personal camera or map-tile free explore', () => {
    expect(shouldApplyRemotePlayerMapView(true, null)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(true, undefined)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(true, 'cam-1')).toBe(false);
    expect(shouldApplyRemotePlayerMapView(true, null, true)).toBe(false);
    expect(shouldApplyRemotePlayerMapView(true, null, false)).toBe(true);
  });

  it('personalCameraTargetsUnsharedMap when the camera map is no longer shared with players', () => {
    const maps = [
      { id: 'm1', shareWithPlayers: true },
      { id: 'm2', shareWithPlayers: false },
    ];
    const cams = [{ id: 'c1', mapId: 'm1' }];
    expect(personalCameraTargetsUnsharedMap('c1', cams, maps)).toBe(false);
    const cams2 = [{ id: 'c2', mapId: 'm2' }];
    expect(personalCameraTargetsUnsharedMap('c2', cams2, maps)).toBe(true);
    expect(personalCameraTargetsUnsharedMap(null, cams2, maps)).toBe(false);
  });

  it('freeMapExploreTargetsUnsharedMap when free explore map is un-shared', () => {
    const maps = [{ id: 'm1', shareWithPlayers: false }];
    expect(freeMapExploreTargetsUnsharedMap('m1', true, maps)).toBe(true);
    expect(freeMapExploreTargetsUnsharedMap('m1', false, maps)).toBe(false);
    expect(freeMapExploreTargetsUnsharedMap(null, true, maps)).toBe(false);
  });

  it('countPlayerMapStripTiles — hide strip when ≤1 tile', () => {
    const mapShared = { id: 'm1', shareWithPlayers: true };
    const mapNotShared = { id: 'm2', shareWithPlayers: false };
    expect(countPlayerMapStripTiles([], [])).toBe(0);
    expect(countPlayerMapStripTiles([{ map: mapShared, gmViews: [], cams: [] }], [])).toBe(1);
    expect(
      countPlayerMapStripTiles([{ map: mapShared, gmViews: [{ id: 'v1' }], cams: [] }], []),
    ).toBe(2);
    expect(
      countPlayerMapStripTiles([{ map: mapNotShared, gmViews: [{ id: 'v1' }], cams: [] }], []),
    ).toBe(1);
    expect(countPlayerMapStripTiles([], [{ id: 'o1' }])).toBe(1);
    expect(countPlayerMapStripTiles([], [{ id: 'o1' }, { id: 'o2' }])).toBe(2);
  });
});
