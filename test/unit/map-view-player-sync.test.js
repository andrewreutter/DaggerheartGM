import { describe, it, expect } from 'vitest';
import { shouldApplyRemotePlayerMapView } from '../../src/client/lib/map-view-player-sync.js';

describe('map-view-player-sync', () => {
  it('applies remote GM view to the GM client regardless of override flag', () => {
    expect(shouldApplyRemotePlayerMapView(false, false)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(false, true)).toBe(true);
  });

  it('applies remote view to players only when not locally overriding', () => {
    expect(shouldApplyRemotePlayerMapView(true, false)).toBe(true);
    expect(shouldApplyRemotePlayerMapView(true, true)).toBe(false);
  });
});
