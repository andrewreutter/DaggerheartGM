import { describe, it, expect } from 'vitest';
import { getEvasionModifierTotal, formatEvasionModifierTooltip } from '../../src/client/lib/helpers.js';

describe('getEvasionModifierTotal', () => {
  it('includes Rogue\'s Dodge +2 from featureState via passiveStatMods (not activeModifiers)', () => {
    const el = {
      evasion: 12,
      instanceId: 'c1',
      featureState: { "Rogue's Dodge": { roguesDodgeActive: true } },
      activeModifiers: [],
    };
    expect(getEvasionModifierTotal(el)).toBe(2);
  });

  it('sums weapon and armor evasion mods with active modifiers', () => {
    const el = {
      weaponMods: { evasion: 1 },
      armorMods: { evasion: 1 },
      activeModifiers: [{ id: 'x', type: 'evasion', value: 2, name: 'Test' }],
    };
    expect(getEvasionModifierTotal(el)).toBe(4);
  });

  it('formatEvasionModifierTooltip lists the same modifier sources as the parenthetical total', () => {
    const el = {
      weaponMods: {
        evasion: -1,
        sources: [{ stat: 'evasion', feature: 'Heavy', weapon: 'Sword', value: -1 }],
      },
      armorMods: {},
      activeBeastform: { name: 'Agile Scout', evasion_bonus: 'Evasion +2' },
      activeModifiers: [],
    };
    const t = formatEvasionModifierTooltip(el);
    expect(t).toContain('Heavy');
    expect(t).toContain('Beastform (Agile Scout)');
    expect(t).toContain('+2');
  });
});
