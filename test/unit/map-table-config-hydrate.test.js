import { describe, it, expect } from 'vitest';

const DEFAULT_MAP_CONFIG = {
  mapImageUrl: null,
  mapDimension: 'width',
  mapSizeFt: 250,
  mapImageNaturalWidth: null,
  mapImageNaturalHeight: null,
  mapAiImagePrompt: null,
};

describe('mapConfig hydrate (matches app.jsx table load / SSE)', () => {
  it('clears a stale mapImageUrl when the server snapshot has null', () => {
    const stale = { ...DEFAULT_MAP_CONFIG, mapImageUrl: 'https://example.com/old.png' };
    const server = { ...DEFAULT_MAP_CONFIG, mapImageUrl: null, mapViewZoomRatio: 1 };
    const next = { ...DEFAULT_MAP_CONFIG, ...server };
    expect(stale.mapImageUrl).toMatch(/^https:/);
    expect(next.mapImageUrl).toBeNull();
    expect(next.mapViewZoomRatio).toBe(1);
  });

  it('applies defaults when spreading server snapshot onto DEFAULT_MAP_CONFIG', () => {
    const server = { mapImageUrl: null, mapSizeFt: 200 };
    const next = { ...DEFAULT_MAP_CONFIG, ...server };
    expect(next.mapDimension).toBe('width');
    expect(next.mapSizeFt).toBe(200);
  });
});
