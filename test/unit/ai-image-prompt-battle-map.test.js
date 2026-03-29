import { describe, it, expect } from 'vitest';
import { buildImagePrompt, buildBattleMapDefaultPrompt } from '../../src/client/lib/ai-image-prompts.js';
import { imageSrcToDataUrlForApi } from '../../src/client/lib/map-image-data-url.js';

describe('buildBattleMapDefaultPrompt', () => {
  it('uses map size for both dimensions when square (300 example)', () => {
    const p = buildBattleMapDefaultPrompt(300);
    expect(p).toContain("300'x300'");
    expect(p).toContain('orthographic top-down');
    expect(p).toContain('stalactites');
  });

  it('uses width × height from map config and image aspect (matches toolbar)', () => {
    const p = buildBattleMapDefaultPrompt({
      mapSizeFt: 100,
      mapDimension: 'width',
      mapImageNaturalWidth: 200,
      mapImageNaturalHeight: 100,
    });
    expect(p).toContain("100'x50'");
  });

  it('clamps size to valid range', () => {
    expect(buildBattleMapDefaultPrompt(5000)).toContain("3000'x3000'");
    expect(buildBattleMapDefaultPrompt(-5)).toContain("1'x1'");
  });
});

describe('buildImagePrompt battleMap', () => {
  it('delegates to buildBattleMapDefaultPrompt with mapSizeFt', () => {
    const p = buildImagePrompt({ mapSizeFt: 250 }, 'battleMap');
    expect(p).toContain("250'x250'");
  });
});

describe('buildImagePrompt adventures (regression)', () => {
  it('still uses adventure branch', () => {
    const p = buildImagePrompt({ name: 'Lost Mine' }, 'adventures');
    expect(p).toContain('adventure setting');
    expect(p).toContain('Lost Mine');
  });
});

describe('imageSrcToDataUrlForApi', () => {
  it('returns data URLs unchanged', async () => {
    const d = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await imageSrcToDataUrlForApi(d)).toBe(d);
  });
});
