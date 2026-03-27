import { describe, it, expect } from 'vitest';
import {
  gmMapStripFullMapTileActive,
  playerMapStripFullMapTileActive,
} from '../../src/client/lib/map-view-strip-active.js';

describe('gmMapStripFullMapTileActive', () => {
  it('is active only in free-scroll (no named view), for the framed map', () => {
    expect(
      gmMapStripFullMapTileActive({
        gmActiveViewId: null,
        mapId: 'map-a',
        activeMapIdResolved: 'map-a',
      }),
    ).toBe(true);
  });

  it('is not active when a named view is selected, even on the same map', () => {
    expect(
      gmMapStripFullMapTileActive({
        gmActiveViewId: 'view-1',
        mapId: 'map-a',
        activeMapIdResolved: 'map-a',
      }),
    ).toBe(false);
  });

  it('is not active for a different map while another map is framed in free-scroll', () => {
    expect(
      gmMapStripFullMapTileActive({
        gmActiveViewId: null,
        mapId: 'map-b',
        activeMapIdResolved: 'map-a',
      }),
    ).toBe(false);
  });
});

describe('playerMapStripFullMapTileActive', () => {
  it('is active only in free explore on that map', () => {
    expect(
      playerMapStripFullMapTileActive({
        playerActivePersonalCameraId: null,
        playerFreeMapExplore: true,
        playerFreeExploreMapId: 'map-a',
        mapId: 'map-a',
      }),
    ).toBe(true);
  });

  it('is not active when following a GM view (avoids double highlight with view tile)', () => {
    expect(
      playerMapStripFullMapTileActive({
        playerActivePersonalCameraId: null,
        playerFreeMapExplore: false,
        playerFreeExploreMapId: 'map-a',
        mapId: 'map-a',
      }),
    ).toBe(false);
  });
});
