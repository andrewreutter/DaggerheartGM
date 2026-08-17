import { describe, it, expect } from 'vitest';
import {
  isGenericMapName,
  pickRichestMapForUrl,
  planTableMapLibraryImport,
  scoreMapRichness,
} from '../../src/client/lib/map-library-import.js';

describe('scoreMapRichness / pickRichestMapForUrl', () => {
  it('prefers a named map with artist, views, overlay, and image over Map N', () => {
    const generic = { name: 'Map 2', mapImageUrl: 'https://ex/same.jpg' };
    const rich = {
      name: 'Crossroads',
      artist: 'Grim Press',
      mapImageUrl: 'https://ex/same.jpg',
      overlayPng: 'data:image/png;base64,xx',
    };
    expect(scoreMapRichness(rich, { viewCount: 3, dressingCount: 2 })).toBeGreaterThan(
      scoreMapRichness(generic, { viewCount: 1 }),
    );
    expect(pickRichestMapForUrl([
      { map: generic, viewCount: 1 },
      { map: rich, viewCount: 3, overlay: true, dressingCount: 2 },
    ])).toBe(rich);
  });

  it('treats Map N as generic', () => {
    expect(isGenericMapName('Map 1')).toBe(true);
    expect(isGenericMapName('map 12')).toBe(true);
    expect(isGenericMapName('Crossroads')).toBe(false);
  });
});

describe('planTableMapLibraryImport', () => {
  it('dedupes by image URL and links all rows to the richest library item', () => {
    const maps = [
      { id: 'a', name: 'Map 1', mapImageUrl: 'https://ex/same.jpg' },
      { id: 'b', name: 'Forest', artist: 'Ada', mapImageUrl: 'https://ex/same.jpg' },
    ];
    const plan = planTableMapLibraryImport(maps, {
      mapViews: [{ mapId: 'b' }, { mapId: 'b' }],
      elements: [],
    });
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].name).toBe('Forest');
    expect(plan.link).toHaveLength(2);
    expect(new Set(plan.link.map((l) => l.libraryMapId)).size).toBe(1);
  });

  it('does not dedupe blanks — one library row each', () => {
    const maps = [
      { id: 'a', name: 'Blank A' },
      { id: 'b', name: 'Blank B' },
    ];
    const plan = planTableMapLibraryImport(maps);
    expect(plan.create).toHaveLength(2);
    expect(plan.link).toHaveLength(2);
    expect(plan.link[0].libraryMapId).not.toBe(plan.link[1].libraryMapId);
  });

  it('links to an existing library row with the same URL', () => {
    const maps = [{ id: 'a', name: 'X', mapImageUrl: 'https://ex/m.jpg' }];
    const plan = planTableMapLibraryImport(maps, {
      existingLibraryByUrl: new Map([['https://ex/m.jpg', { id: 'existing-lib' }]]),
    });
    expect(plan.create).toHaveLength(0);
    expect(plan.link).toEqual([{ mapId: 'a', libraryMapId: 'existing-lib' }]);
  });

  it('skips rows that already have libraryMapId', () => {
    const plan = planTableMapLibraryImport([
      { id: 'a', libraryMapId: 'already', mapImageUrl: 'https://ex/m.jpg' },
    ]);
    expect(plan.create).toHaveLength(0);
    expect(plan.link).toHaveLength(0);
  });
});
