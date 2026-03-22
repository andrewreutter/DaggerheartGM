/**
 * Giant Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Giant.md
 */

export const Endurance = {
  name: 'Endurance',
  description: 'Gain an additional Hit Point slot at character creation.',
  passiveStatMods: {
    maxHP: 1,
  },
};

export const Reach = {
  name: 'Reach',
  description:
    'Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close range instead.',
  rangeOverrides: { melee: 'veryClose' },
  onIntent: (table) => {
    table.me.weapons.forEach((weapon) => {
      if (weapon.range === 'Melee') {
        weapon.range = 'Very Close';
      }
    });
  }
};
