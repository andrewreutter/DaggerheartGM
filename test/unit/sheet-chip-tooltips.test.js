import { describe, it, expect } from 'vitest';
import { buildModifierChipHoverTitle } from '../../src/client/lib/modifier-chip-title.js';
import { buildGuideCardChipTipText } from '../../src/client/lib/guide-feature-card-tip-text.js';

describe('buildModifierChipHoverTitle', () => {
  const mod = { name: "Rogue's Dodge", type: 'evasion', value: 2 };

  it('uses mod.description when set', () => {
    const desc = 'Spend 3 Hope to gain a +2 bonus to your Evasion.';
    expect(buildModifierChipHoverTitle({ ...mod, description: desc })).toBe(desc);
  });

  it('trims mod.description', () => {
    expect(buildModifierChipHoverTitle({ ...mod, description: '  Hello  ' })).toBe('Hello');
  });

  it('respects explicit tooltip override', () => {
    expect(
      buildModifierChipHoverTitle(
        { ...mod, description: 'From feature' },
        { tooltip: 'Override', eligible: true }
      )
    ).toBe('Override');
  });

  it('falls back to generic click hint when no description', () => {
    expect(buildModifierChipHoverTitle(mod)).toBe("Rogue's Dodge — click to use");
  });

  it('uses roll hint for roll-mode modifiers', () => {
    expect(buildModifierChipHoverTitle({ name: 'Test', mode: 'roll' })).toBe('Test — click to include in next roll');
  });

  it('uses single-word cycle for persistent modifiers', () => {
    expect(
      buildModifierChipHoverTitle({ name: 'Rally Die', type: 'persistent', refreshOn: 'session' })
    ).toBe("Rally Die (active until session)");
  });
});

describe('buildGuideCardChipTipText', () => {
  it('prefers chip.description over featRow.description', () => {
    expect(
      buildGuideCardChipTipText(
        { name: 'X', description: 'Chip body' },
        { name: 'Feat', description: 'Row body' },
        'X'
      )
    ).toBe('Chip body');
  });

  it('falls back to featRow.description when chip has none', () => {
    expect(
      buildGuideCardChipTipText({ name: "Rogue's Dodge" }, { description: 'Row only' }, "Rogue's Dodge")
    ).toBe('Row only');
  });

  it('falls back to resolved label', () => {
    expect(buildGuideCardChipTipText({ name: 'Y' }, {}, 'Y')).toBe('Y');
  });
});
