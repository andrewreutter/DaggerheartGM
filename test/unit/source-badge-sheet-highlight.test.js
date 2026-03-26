import { describe, it, expect } from 'vitest';
import {
  sheetHighlightMatchesGuideFeatRow,
  sheetHighlightMatchesAbility,
  shouldDimFeatOrAbilityRow,
  isNeutralSheetHighlight,
} from '../../src/client/lib/source-badge-sheet-highlight.js';

const el = {
  classId: 'srd-cls-bard',
  subclassId: 'srd-sub-beastbound',
  communityId: 'srd-com-river',
  ancestryIds: ['srd-anc-faerie'],
};

describe('source-badge-sheet-highlight', () => {
  it('neutral highlights never dim', () => {
    expect(isNeutralSheetHighlight(null)).toBe(true);
    expect(isNeutralSheetHighlight({ kind: 'library' })).toBe(true);
    const row = { type: 'subclass', name: 'X' };
    expect(sheetHighlightMatchesGuideFeatRow(row, el, { kind: 'library' })).toBe(true);
  });

  it('class highlight matches class + beastform rows', () => {
    const h = { kind: 'class' };
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'class', name: 'A' }, el, h)).toBe(true);
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'beastform', name: 'Bite' }, el, h)).toBe(true);
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'subclass', name: 'S' }, el, h)).toBe(false);
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'ancestry', name: 'A', source: 'Faerie' }, el, h)).toBe(false);
  });

  it('class highlight matches scope key for hope-style rows', () => {
    const h = { kind: 'class' };
    expect(
      sheetHighlightMatchesGuideFeatRow(
        { name: 'Hope', _sourceScopeKey: 'classes:srd-cls-bard' },
        el,
        h,
      ),
    ).toBe(true);
  });

  it('subclass highlight matches subclass rows and scope keys', () => {
    const h = { kind: 'subclass' };
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'subclass', name: 'Beastbound' }, el, h)).toBe(true);
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'class', name: 'Bard' }, el, h)).toBe(false);
    expect(
      sheetHighlightMatchesGuideFeatRow(
        { type: 'class', _sourceScopeKey: 'subclasses:srd-sub-beastbound' },
        el,
        h,
      ),
    ).toBe(true);
  });

  it('ancestry highlight matches source label', () => {
    const h = { kind: 'ancestry', name: 'Faerie' };
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'ancestry', source: 'Faerie' }, el, h)).toBe(true);
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'ancestry', source: 'Human' }, el, h)).toBe(false);
  });

  it('domain highlight only matches ability rows by domain', () => {
    const h = { kind: 'domain', name: 'Arcana' };
    expect(sheetHighlightMatchesGuideFeatRow({ type: 'class', name: 'A' }, el, h)).toBe(false);
    expect(sheetHighlightMatchesAbility({ domain: 'Arcana' }, el, h)).toBe(true);
    expect(sheetHighlightMatchesAbility({ domain: 'Bone' }, el, h)).toBe(false);
  });

  it('shouldDimFeatOrAbilityRow routes abilities to domain logic', () => {
    const h = { kind: 'class' };
    const ability = { domain: 'Arcana', name: 'Fireball' };
    const featRow = { type: 'ability', name: 'Fireball' };
    expect(shouldDimFeatOrAbilityRow(ability, featRow, el, h)).toBe(true);
    expect(shouldDimFeatOrAbilityRow(null, { type: 'class', name: 'X' }, el, h)).toBe(false);
  });
});
