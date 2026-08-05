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

describe('buildImagePrompt characters', () => {
  it('includes name and character portrait intro', () => {
    const p = buildImagePrompt({ name: 'Lyra Ashveil' }, 'characters');
    expect(p).toContain('character portrait');
    expect(p).toContain('Lyra Ashveil');
  });

  it('includes pronouns when present', () => {
    const p = buildImagePrompt({ name: 'Lyra', pronouns: 'she/her' }, 'characters');
    expect(p).toContain('she/her');
  });

  it('includes resolved class and ancestry names', () => {
    const p = buildImagePrompt({
      name: 'Lyra',
      class: 'Bard',
      subclass: 'Troubadour',
      ancestry: 'Faerie',
      community: 'Wanderers',
    }, 'characters');
    expect(p).toContain('Bard');
    expect(p).toContain('Faerie');
    expect(p).toContain('Wanderers');
  });

  it('includes armor name when present', () => {
    const p = buildImagePrompt({ name: 'Lyra', armor: 'Leather Armor' }, 'characters');
    expect(p).toContain('Wearing: Leather Armor');
  });

  it('includes primary weapon when present', () => {
    const p = buildImagePrompt({ name: 'Lyra', primaryWeapon: 'Longsword' }, 'characters');
    expect(p).toContain('Wielding: Longsword');
  });

  it('includes both weapons joined with and', () => {
    const p = buildImagePrompt({ name: 'Lyra', primaryWeapon: 'Longsword', secondaryWeapon: 'Shortbow' }, 'characters');
    expect(p).toContain('Wielding: Longsword and Shortbow');
  });

  it('omits weapons/armor sections when absent', () => {
    const p = buildImagePrompt({ name: 'Lyra' }, 'characters');
    expect(p).not.toContain('Wielding');
    expect(p).not.toContain('Wearing');
  });

  it('includes description when present', () => {
    const p = buildImagePrompt({ name: 'Lyra', description: 'A wandering musician with silver hair.' }, 'characters');
    expect(p).toContain('A wandering musician with silver hair.');
  });

  it('works with empty formData', () => {
    const p = buildImagePrompt({}, 'characters');
    expect(p).toContain('character portrait');
    expect(p).toContain('a character');
  });
});

describe('imageSrcToDataUrlForApi', () => {
  it('returns data URLs unchanged', async () => {
    const d = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await imageSrcToDataUrlForApi(d)).toBe(d);
  });
});
