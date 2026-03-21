/**
 * Simiah Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Simiah.md
 */

export const NaturalClimber = {
  name: 'Natural Climber',
  description:
    'You have advantage on Agility Rolls that involve balancing and climbing.',
  advantageTriggers: [
    'Agility Rolls that involve balancing and climbing',
  ],
};

export const Nimble = {
  name: 'Nimble',
  description: 'You gain +1 to your Evasion.',
  passiveStatMods: {
    evasion: 1,
  },
};
