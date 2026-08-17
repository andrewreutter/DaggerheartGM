import { describe, it, expect } from 'vitest';
import {
  libraryMapCameraTileKey,
  libraryMapCameraViews,
  mapCameraTileImageStyle,
  shouldShowLibraryMapCameraTiles,
} from '../../src/client/lib/map-library-card-cameras.js';

describe('libraryMapCameraViews', () => {
  it('returns empty for missing or empty mapViews', () => {
    expect(libraryMapCameraViews(null)).toEqual([]);
    expect(libraryMapCameraViews({})).toEqual([]);
    expect(libraryMapCameraViews({ mapViews: [] })).toEqual([]);
    expect(libraryMapCameraViews({ mapViews: [null, undefined] })).toEqual([]);
  });

  it('keeps defined camera rows in order', () => {
    const a = { id: 'v1', name: 'Main' };
    const b = { id: 'v2', name: 'Close' };
    expect(libraryMapCameraViews({ mapViews: [a, null, b] })).toEqual([a, b]);
  });
});

describe('shouldShowLibraryMapCameraTiles', () => {
  it('is false for zero or one camera', () => {
    expect(shouldShowLibraryMapCameraTiles({})).toBe(false);
    expect(shouldShowLibraryMapCameraTiles({ mapViews: [{ id: 'v1' }] })).toBe(false);
  });

  it('is true for two or more cameras', () => {
    expect(shouldShowLibraryMapCameraTiles({
      mapViews: [{ id: 'v1' }, { id: 'v2' }],
    })).toBe(true);
  });
});

describe('mapCameraTileImageStyle', () => {
  it('returns null when the camera has no visible-norm crop', () => {
    expect(mapCameraTileImageStyle(null)).toBeNull();
    expect(mapCameraTileImageStyle({})).toBeNull();
    expect(mapCameraTileImageStyle({ mapViewVisibleNorm: { x: 0, y: 0, w: 0, h: 1 } })).toBeNull();
  });

  it('positions the image so the visible-norm rect fills the tile', () => {
    expect(mapCameraTileImageStyle({
      mapViewVisibleNorm: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    })).toEqual({
      position: 'absolute',
      width: '200%',
      height: '200%',
      left: '-50%',
      top: '-50%',
      maxWidth: 'none',
      maxHeight: 'none',
    });
  });

  it('crops the top-left quadrant', () => {
    const style = mapCameraTileImageStyle({
      mapViewVisibleNorm: { x: 0, y: 0, w: 0.5, h: 0.5 },
    });
    expect(style.left).toBe('0%');
    expect(style.top).toBe('0%');
    expect(style.width).toBe('200%');
    expect(style.height).toBe('200%');
  });
});

describe('libraryMapCameraTileKey', () => {
  it('prefers the view id and falls back to index', () => {
    expect(libraryMapCameraTileKey({ id: 'v1' }, 0)).toBe('v1');
    expect(libraryMapCameraTileKey({}, 2)).toBe('cam-2');
  });
});
