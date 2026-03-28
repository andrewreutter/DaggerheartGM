import { describe, it, expect } from 'vitest';
import {
  shouldApplyRemotePlayerMapView,
  freeMapExploreTargetsUnsharedMap,
  playerCanAccessMapViewSelection,
  countPlayerMapStripTiles,
  shouldShowPlayerMapViewStrip,
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

  it('countPlayerMapStripTiles counts full-map tile plus views per batch', () => {
    const batches = [
      {
        map: { id: 'm1', shareWithPlayers: true },
        gmViews: [{ id: 'v1' }, { id: 'v2' }],
      },
      {
        map: { id: 'm2', shareWithPlayers: false },
        gmViews: [{ id: 'v3' }],
      },
    ];
    expect(countPlayerMapStripTiles(batches)).toBe(1 + 2 + 0 + 1);
  });

  it('shouldShowPlayerMapViewStrip hides strip when there is only one selectable tile', () => {
    expect(shouldShowPlayerMapViewStrip(0)).toBe(false);
    expect(shouldShowPlayerMapViewStrip(1)).toBe(false);
    expect(shouldShowPlayerMapViewStrip(2)).toBe(true);
  });
});
