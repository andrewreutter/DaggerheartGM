import { describe, it, expect } from 'vitest';
import { collectPrivateReferencedMaps, sceneCanBePublic } from '../../src/client/lib/map-scene-public.js';

describe('collectPrivateReferencedMaps', () => {
  it('lists private and missing referenced maps', () => {
    const scene = {
      maps: [
        { libraryMapId: 'pub', name: 'A' },
        { libraryMapId: 'priv', name: 'B' },
        { libraryMapId: 'missing', name: 'C' },
        { libraryMapId: 'priv', name: 'B again' },
      ],
    };
    const priv = collectPrivateReferencedMaps(scene, {
      pub: { id: 'pub', name: 'Public', is_public: true },
      priv: { id: 'priv', name: 'Private', is_public: false },
    });
    expect(priv.map((p) => p.id)).toEqual(['priv', 'missing']);
    expect(sceneCanBePublic(scene, {
      pub: { is_public: true },
      priv: { is_public: true },
      missing: { is_public: true },
    })).toBe(true);
  });

  it('allows publish when every referenced map is public', () => {
    const scene = { maps: [{ libraryMapId: 'a' }] };
    expect(sceneCanBePublic(scene, { a: { is_public: true } })).toBe(true);
    expect(sceneCanBePublic(scene, { a: { is_public: false } })).toBe(false);
  });
});
