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
  // Note: This modifies the effective range of weapons/features from Melee to Very Close.
  // The V2 API doesn't have a declarative way to modify weapon ranges. This would require
  // engine support to intercept range calculations. For now, this is a narrative feature
  // that the GM must manually apply, or it requires an engine extension.
  // Purely narrative implementation until engine supports range modification.
};
