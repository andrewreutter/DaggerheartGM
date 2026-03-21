/**
 * Ribbet Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Ribbet.md
 */

export const Amphibious = {
  name: 'Amphibious',
  description:
    'You can breathe and move naturally underwater.',
  // Purely narrative feature - no mechanical effect
};

export const LongTongue = {
  name: 'Long Tongue',
  description:
    'You can use your long tongue to grab onto things within Close range. Mark a Stress to use your tongue as a Finesse Close weapon that deals d12 physical damage using your Proficiency.',
  virtualWeapons: [
    {
      name: 'Long Tongue',
      trait: 'finesse',
      range: 'close',
      damage: 'd12',
      description: 'Mark 1 Stress to use your tongue as a weapon.',
      chips: [
        {
          description: 'Mark 1 Stress to use your tongue.',
          placements: ['card'],
          stressCost: 1,
          onUse(table) {
            // The stress cost is handled automatically by the chip system
            // The virtual weapon is already available, this chip just confirms usage
          },
        },
      ],
    },
  ],
};
