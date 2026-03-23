import { describe, it, expect } from 'vitest';
import {
  parseBeastformStatBonus,
  passiveStatModsFromBeastformRow,
  advantageTriggersFromBeastformRow,
} from '../../../../src/features-v2/beastforms/beastform-row-stat-mods.js';

describe('beastform-row-stat-mods', () => {
  it('parseBeastformStatBonus matches SRD bonus strings', () => {
    expect(parseBeastformStatBonus('Agility +1')).toEqual({ stat: 'agility', bonus: 1 });
    expect(parseBeastformStatBonus('Evasion +2')).toEqual({ stat: 'evasion', bonus: 2 });
    expect(parseBeastformStatBonus('')).toBeNull();
  });

  it('passiveStatModsFromBeastformRow maps trait + evasion lines to stats keys', () => {
    expect(
      passiveStatModsFromBeastformRow({
        trait_bonus: 'Instinct +1',
        evasion_bonus: 'Evasion +3',
      })
    ).toEqual({ instinct: 1, evasion: 3 });
  });

  it('returns null when no bonuses', () => {
    expect(passiveStatModsFromBeastformRow({ trait_bonus: '', evasion_bonus: '' })).toBeNull();
  });

  it('advantageTriggersFromBeastformRow maps advantages keywords to roll phrases', () => {
    expect(
      advantageTriggersFromBeastformRow({
        advantages: 'deceive, locate, sneak',
      })
    ).toEqual(['rolls to deceive', 'rolls to locate', 'rolls to sneak']);
    expect(advantageTriggersFromBeastformRow({ advantages: '' })).toBeNull();
  });
});
