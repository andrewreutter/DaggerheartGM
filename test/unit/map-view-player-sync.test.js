import { describe, it, expect } from 'vitest';
import {
  shouldApplyRemotePlayerMapView,
  isDecodedMapViewAtOrigin,
  shouldPreferCachedPlayerRemoteView,
  freeMapExploreTargetsUnsharedMap,
  playerCanAccessMapViewSelection,
} from '../../src/client/lib/map-view-player-sync.js';

describe('map-view-player-sync', () => {
  it('applies remote GM view to the GM client regardless of free explore', () => {
    expect(shouldApplyRemotePlayerMapView(false, false)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(false, true)).toBe(true);
  });

  it('applies remote view to players only when not in map-tile free explore', () => {
    expect(shouldApplyRemotePlayerMapView(true, false)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(true, true)).toBe(false);
  });

  it('detects when a decoded map view is effectively at the origin', () => {
    expect(isDecodedMapViewAtOrigin({ scrollLeft: 0, scrollTop: 0 })).toBe(true);
    expect(isDecodedMapViewAtOrigin({ scrollLeft: 0.2, scrollTop: 0.4 })).toBe(true);
    expect(isDecodedMapViewAtOrigin({ scrollLeft: 2, scrollTop: 0 })).toBe(false);
  });

  it('prefers the cached remote view when a return-switch regresses to 0,0', () => {
    expect(
      shouldPreferCachedPlayerRemoteView({
        switchedViews: true,
        liveDecoded: { scrollLeft: 0, scrollTop: 0 },
        cachedDecoded: { scrollLeft: 140, scrollTop: 80 },
      }),
    ).toBe(true);
    expect(
      shouldPreferCachedPlayerRemoteView({
        switchedViews: true,
        liveDecoded: { scrollLeft: 140, scrollTop: 80 },
        cachedDecoded: { scrollLeft: 20, scrollTop: 10 },
      }),
    ).toBe(false);
    expect(
      shouldPreferCachedPlayerRemoteView({
        switchedViews: false,
        liveDecoded: { scrollLeft: 0, scrollTop: 0 },
        cachedDecoded: { scrollLeft: 140, scrollTop: 80 },
      }),
    ).toBe(false);
  });

  it('freeMapExploreTargetsUnsharedMap when free explore map is un-shared', () => {
    const maps = [{ id: 'm1', shareWithPlayers: false }];
    expect(freeMapExploreTargetsUnsharedMap('m1', true, maps)).toBe(true);
    expect(freeMapExploreTargetsUnsharedMap('m1', false, maps)).toBe(false);
    expect(freeMapExploreTargetsUnsharedMap(null, true, maps)).toBe(false);
  });

  it('playerCanAccessMapViewSelection respects broadcast and share flags', () => {
    const table = {
      maps: [{ id: 'a', shareWithPlayers: true }],
      mapViews: [{ id: 'v1', mapId: 'a', broadcastToPlayers: true }],
    };
    expect(playerCanAccessMapViewSelection(table, { viewId: 'v1' })).toBe(true);
    expect(
      playerCanAccessMapViewSelection(table, { freeMapExploreMapId: 'a' }),
    ).toBe(true);
    expect(
      playerCanAccessMapViewSelection(
        { maps: [{ id: 'a', shareWithPlayers: false }], mapViews: [] },
        { freeMapExploreMapId: 'a' },
      ),
    ).toBe(false);
  });
});
