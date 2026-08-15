import { describe, it, expect } from 'vitest';
import {
  normalizeMapArtistFields,
  normalizeMapArtistUrl,
  normalizeMapName,
  resolveMapArtistCredit,
} from '../../src/client/lib/map-artist.js';

describe('normalizeMapName', () => {
  it('trims and rejects whitespace-only', () => {
    expect(normalizeMapName('  Woods  ')).toBe('Woods');
    expect(normalizeMapName('   ')).toBe('');
  });
});

describe('normalizeMapArtistUrl', () => {
  it('returns empty without an artist', () => {
    expect(normalizeMapArtistUrl('', 'https://example.com')).toBe('');
    expect(normalizeMapArtistUrl('   ', 'https://example.com')).toBe('');
  });

  it('accepts http(s) and prepends https for bare hosts', () => {
    expect(normalizeMapArtistUrl('Ada', 'https://example.com/ada')).toBe('https://example.com/ada');
    expect(normalizeMapArtistUrl('Ada', 'example.com/ada')).toBe('https://example.com/ada');
  });

  it('rejects non-http schemes', () => {
    expect(normalizeMapArtistUrl('Ada', 'javascript:alert(1)')).toBe('');
    expect(normalizeMapArtistUrl('Ada', 'data:text/html,hi')).toBe('');
  });
});

describe('normalizeMapArtistFields', () => {
  it('clears the URL when artist is empty', () => {
    expect(normalizeMapArtistFields('', 'https://example.com')).toEqual({
      artist: '',
      artistUrl: '',
    });
  });

  it('keeps a safe URL when artist is set', () => {
    expect(normalizeMapArtistFields(' Ada ', ' example.com ')).toEqual({
      artist: 'Ada',
      artistUrl: 'https://example.com/',
    });
  });
});

describe('resolveMapArtistCredit', () => {
  it('returns null without an artist', () => {
    expect(resolveMapArtistCredit({})).toBeNull();
    expect(resolveMapArtistCredit({ artist: '  ', artistUrl: 'https://x.com' })).toBeNull();
  });

  it('returns artist-only credit when URL is missing or unsafe', () => {
    expect(resolveMapArtistCredit({ artist: 'Ada' })).toEqual({ artist: 'Ada', href: null });
    expect(resolveMapArtistCredit({ artist: 'Ada', artistUrl: 'javascript:alert(1)' })).toEqual({
      artist: 'Ada',
      href: null,
    });
  });

  it('returns a link href when URL is safe', () => {
    expect(resolveMapArtistCredit({ artist: 'Ada', artistUrl: 'https://maps.example/ada' })).toEqual({
      artist: 'Ada',
      href: 'https://maps.example/ada',
    });
  });
});
