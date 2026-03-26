import { describe, expect, it } from 'vitest';
import {
  getSheetSourceChipPalette,
  resolveSheetSourcePaletteKey,
} from '../../src/client/lib/sheet-source-chip-styles.js';

describe('resolveSheetSourcePaletteKey', () => {
  it('maps activeFeatures type when sourceType is missing', () => {
    expect(resolveSheetSourcePaletteKey({ type: 'class' }, undefined)).toBe('class');
    expect(resolveSheetSourcePaletteKey({ name: 'Life Support', type: 'class' }, undefined)).toBe('class');
  });

  it('prefers explicit sourceType', () => {
    expect(resolveSheetSourcePaletteKey({ type: 'class', sourceType: 'subclass' }, undefined)).toBe('subclass');
    expect(resolveSheetSourcePaletteKey({ type: 'class' }, 'ancestry')).toBe('ancestry');
  });

  it("maps mistaken sourceType 'ability' to domain for LOADOUT chips", () => {
    expect(resolveSheetSourcePaletteKey({ type: 'ability', sourceType: 'ability' }, undefined)).toBe('domain');
    expect(resolveSheetSourcePaletteKey({ type: 'ability' }, 'ability')).toBe('domain');
  });
});

describe('getSheetSourceChipPalette', () => {
  it('returns default palette for unknown or empty source', () => {
    const d = getSheetSourceChipPalette(undefined);
    expect(d.groupOuter).toContain('border-dh-border');
    expect(d.actionDefault).toContain('border-dh-border');
    expect(getSheetSourceChipPalette('not-a-real-type')).toBe(d);
  });

  it('maps known source types to distinct action surfaces', () => {
    const cls = getSheetSourceChipPalette('class');
    expect(cls.actionDefault).toContain('violet');
    expect(cls.groupOuter).toContain('violet');

    const sub = getSheetSourceChipPalette('subclass');
    expect(sub.actionDefault).toContain('sky');

    const dom = getSheetSourceChipPalette('domain');
    expect(dom).toBe(getSheetSourceChipPalette('class'));
    expect(dom.actionDefault).toContain('violet');
    expect(getSheetSourceChipPalette('ability')).toBe(dom);
  });
});
