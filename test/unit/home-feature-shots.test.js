import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  HOME_FEATURE_SHOTS,
  HOME_FEATURE_CAROUSEL_INTERVAL_MS,
  wrapHomeFeatureShotIndex,
  homeFeatureCarouselDwellMs,
  computeScaleToFit,
} from '../../src/client/components/HomeFeatureShots.jsx';

describe('wrapHomeFeatureShotIndex', () => {
  it('advances forward and wraps from the last slide to the first', () => {
    expect(wrapHomeFeatureShotIndex(0, 6, 1)).toBe(1);
    expect(wrapHomeFeatureShotIndex(5, 6, 1)).toBe(0);
  });

  it('steps backward and wraps from the first slide to the last', () => {
    expect(wrapHomeFeatureShotIndex(0, 6, -1)).toBe(5);
    expect(wrapHomeFeatureShotIndex(2, 6, -1)).toBe(1);
  });

  it('clamps a direct select through modulo without changing the requested slide', () => {
    expect(wrapHomeFeatureShotIndex(3, 6, 0)).toBe(3);
    expect(wrapHomeFeatureShotIndex(8, 6, 0)).toBe(2);
  });

  it('returns 0 when the shot list is empty or not a positive length', () => {
    expect(wrapHomeFeatureShotIndex(2, 0, 1)).toBe(0);
    expect(wrapHomeFeatureShotIndex(2, -3, 1)).toBe(0);
    expect(wrapHomeFeatureShotIndex(2, Number.NaN, 1)).toBe(0);
  });
});

describe('homeFeatureCarouselDwellMs', () => {
  it('uses the standard interval for screenshot slides', () => {
    expect(homeFeatureCarouselDwellMs({ id: 'gm-moves' }, 3)).toBe(HOME_FEATURE_CAROUSEL_INTERVAL_MS);
  });

  it('holds Public Games long enough to rotate through every live public table card', () => {
    const shot = { kind: 'publicTables' };
    expect(homeFeatureCarouselDwellMs(shot, 3)).toBe(HOME_FEATURE_CAROUSEL_INTERVAL_MS * 3);
    expect(homeFeatureCarouselDwellMs(shot, 1)).toBe(HOME_FEATURE_CAROUSEL_INTERVAL_MS);
    expect(homeFeatureCarouselDwellMs(shot, 0)).toBe(HOME_FEATURE_CAROUSEL_INTERVAL_MS);
  });
});

describe('computeScaleToFit', () => {
  it('returns the smaller axis ratio so the content fits inside the container', () => {
    expect(computeScaleToFit(100, 50, 200, 200)).toBe(2);
    expect(computeScaleToFit(100, 50, 200, 80)).toBe(1.6);
  });

  it('allows upscaling when the container is larger than the content', () => {
    expect(computeScaleToFit(20, 10, 40, 30)).toBe(2);
  });

  it('returns 1 when any side is missing or not positive', () => {
    expect(computeScaleToFit(0, 10, 40, 30)).toBe(1);
    expect(computeScaleToFit(20, 10, 0, 30)).toBe(1);
    expect(computeScaleToFit(20, Number.NaN, 40, 30)).toBe(1);
  });
});

describe('HOME_FEATURE_SHOTS public games', () => {
  it('ends with a Public Games shot that uses live table cards instead of a PNG', () => {
    const last = HOME_FEATURE_SHOTS[HOME_FEATURE_SHOTS.length - 1];
    expect(last.id).toBe('public-games');
    expect(last.kind).toBe('publicTables');
    expect(last.image).toBeUndefined();
    expect(last.title).toBe('Public Games');
  });

  it('renders the shared TableCard inside the Public Games shot', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../../src/client/components/HomeFeatureShots.jsx'), 'utf8');
    expect(src).toMatch(/import \{ TableCard, tableCardTitle \} from '\.\/TableCard\.jsx'/);
    expect(src).toMatch(/import\('\.\.\/lib\/api\.js'\)/);
    expect(src).toMatch(/fetchPublicTables\(\)/);
  });

  it('rotates public table cards even when reduced motion is on, and stacks them in one grid cell', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../../src/client/components/HomeFeatureShots.jsx'), 'utf8');
    expect(src).not.toMatch(/if \(reduceMotion \|\| !Array\.isArray\(publicTables\)/);
    expect(src).toMatch(/if \(!Array\.isArray\(publicTables\) \|\| publicTables\.length < 2\) return undefined;/);
    const shotStart = src.indexOf('function HomePublicTablesShot');
    const shot = src.slice(shotStart, src.indexOf('function HomeFeatureCarousel'));
    expect(shot).toMatch(/col-start-1 row-start-1/);
    expect(shot).toMatch(/transform: `scale\(\$\{scale\}\)`/);
  });
});

describe('fetchPublicTables anonymous access', () => {
  it('does not require a signed-in token before calling GET /api/public-tables', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../../src/client/lib/api.js'), 'utf8');
    const start = src.indexOf('export const fetchPublicTables');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, start + 700);
    expect(block).not.toMatch(/throw new Error\('Not signed in'\)/);
    expect(block).toMatch(/token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}/);
  });
});
