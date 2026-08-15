/**
 * Map credit fields (`maps[].artist`, `maps[].artistUrl`) and the bottom-right
 * "Map by …" inset. Pure helpers — no DOM.
 */

export function trimMapArtistField(value) {
  return String(value ?? '').trim();
}

/**
 * Normalize a map name for save. Empty after trim is invalid (caller should not persist).
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMapName(value) {
  return trimMapArtistField(value);
}

/**
 * Safe http(s) href for an artist credit, or '' when missing / invalid / no artist.
 * Bare hosts (`example.com/x`) get `https://`. Rejects javascript:/data:/etc.
 * @param {unknown} artist
 * @param {unknown} url
 * @returns {string}
 */
export function normalizeMapArtistUrl(artist, url) {
  if (!trimMapArtistField(artist)) return '';
  let raw = trimMapArtistField(url);
  if (!raw) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * @param {unknown} artist
 * @param {unknown} url
 * @returns {{ artist: string, artistUrl: string }}
 */
export function normalizeMapArtistFields(artist, url) {
  const nextArtist = trimMapArtistField(artist);
  return {
    artist: nextArtist,
    artistUrl: nextArtist ? normalizeMapArtistUrl(nextArtist, url) : '',
  };
}

/**
 * @param {{ artist?: unknown, artistUrl?: unknown } | null | undefined} map
 * @returns {{ artist: string, href: string | null } | null}
 */
export function resolveMapArtistCredit(map) {
  const artist = trimMapArtistField(map?.artist);
  if (!artist) return null;
  const href = normalizeMapArtistUrl(artist, map?.artistUrl);
  return { artist, href: href || null };
}
