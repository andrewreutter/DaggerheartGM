import { describe, it, expect } from 'vitest';
import { getLibraryItemImageUrls } from '../../src/client/lib/library-item-image-urls.js';

describe('getLibraryItemImageUrls', () => {
  it('merges imageUrl and _additionalImages and drops empties', () => {
    expect(getLibraryItemImageUrls(null)).toEqual([]);
    expect(getLibraryItemImageUrls({})).toEqual([]);
    expect(getLibraryItemImageUrls({ imageUrl: '' })).toEqual([]);
    expect(
      getLibraryItemImageUrls({
        imageUrl: 'https://example.com/a.webp',
        _additionalImages: ['', 'https://example.com/b.webp'],
      }),
    ).toEqual(['https://example.com/a.webp', 'https://example.com/b.webp']);
  });

  it('uses FCG relative image when imageUrl is missing', () => {
    expect(
      getLibraryItemImageUrls({
        _source: 'fcg',
        name: 'Test',
        image: '/images/adversaries/Bear.webp',
      }),
    ).toEqual(['https://freshcutgrass.app/images/adversaries/Bear.webp']);
  });
});
