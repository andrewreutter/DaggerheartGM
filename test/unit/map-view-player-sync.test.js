import { describe, it, expect } from 'vitest';
import {
  shouldApplyRemotePlayerMapView,
  personalCameraTargetsUnsharedMap,
  freeMapExploreTargetsUnsharedMap,
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
});
