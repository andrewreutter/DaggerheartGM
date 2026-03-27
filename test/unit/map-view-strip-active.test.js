import { describe, it, expect } from 'vitest';
import {
  gmMapStripFullMapTileActive,
  playerMapStripFullMapTileActive,
} from '../../src/client/lib/map-view-strip-active.js';

describe('map-view-strip-active', () => {
  it('gm full-map tile is active when no named view is active and map matches', () => {
    expect(
      gmMapStripFullMapTileActive({
        gmActiveViewId: null,
        mapId: 'm1',
        activeMapIdResolved: 'm1',
      }),
    ).toBe(true);
    expect(
      gmMapStripFullMapTileActive({
        gmActiveViewId: 'v1',
        mapId: 'm1',
        activeMapIdResolved: 'm1',
      }),
    ).toBe(false);
  });

  it('player full-map tile is active only in free explore on that map', () => {
    expect(
      playerMapStripFullMapTileActive({
        playerFreeMapExplore: true,
        playerFreeExploreMapId: 'm1',
        mapId: 'm1',
      }),
    ).toBe(true);
    expect(
      playerMapStripFullMapTileActive({
        playerFreeMapExplore: false,
        playerFreeExploreMapId: 'm1',
        mapId: 'm1',
      }),
    ).toBe(false);
  });
});
