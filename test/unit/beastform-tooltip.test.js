import { describe, it, expect } from 'vitest';
import { beastformRowToTooltipMarkdown } from '../../src/features-v2/beastforms/format-beastform-tooltip.js';

describe('beastformRowToTooltipMarkdown', () => {
  it('includes stats and feature bullets from a full registry row', () => {
    const md = beastformRowToTooltipMarkdown({
      id: 'srd-bst-agile-scout',
      name: 'Agile Scout',
      tier: 1,
      examples: '(Fox, Mouse)',
      trait_bonus: 'Agility +1',
      evasion_bonus: 'Evasion +2',
      attack: 'Melee Agility d4 phy',
      advantages: 'deceive, locate, sneak',
      features: [
        { name: 'Agile', description: 'Silent movement.' },
        { name: 'Fragile', description: 'Drop on Major+.' },
      ],
    });
    expect(md).toContain('**Tier 1**');
    expect(md).toContain('(Fox, Mouse)');
    expect(md).toContain('Melee Agility d4 phy');
    expect(md).toContain('Agility +1');
    expect(md).toContain('Evasion +2');
    expect(md).toContain('deceive, locate, sneak');
    expect(md).toContain('**Agile**');
    expect(md).toContain('Silent movement.');
    expect(md).toContain('**Fragile**');
  });

  it('returns empty string for non-objects', () => {
    expect(beastformRowToTooltipMarkdown(null)).toBe('');
    expect(beastformRowToTooltipMarkdown(undefined)).toBe('');
  });
});
