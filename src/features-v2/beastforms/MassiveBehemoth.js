/**
 * SRD: Massive Behemoth — daggerheart-srd/beastforms/Massive Behemoth.md
 */

export const Carrier = {
  name: 'Carrier',
  description: 'You can carry up to four willing allies with you when you move.',
};

export const Demolish = {
  name: 'Demolish',
  description:
    '**Spend a Hope** to move up to Far range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+10** physical damage using your Proficiency and are temporarily _Vulnerable._',
  chips: [
    {
      placements: ['card'],
      hopeCost: 1,
      onUse(table) {
        table.me.actionLoop(
          'Demolish',
          'Move up to Far in a straight line; attack each target in Melee of that line for d8+10 physical (your Proficiency). Successful hits apply Vulnerable (GM resolves positions and rolls).'
        );
      },
    },
  ],
};

export const Undaunted = {
  name: 'Undaunted',
  description: 'You gain a +2 bonus to all your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 2,
    severeThreshold: 2,
  },
};

export const features = [Carrier, Demolish, Undaunted];
