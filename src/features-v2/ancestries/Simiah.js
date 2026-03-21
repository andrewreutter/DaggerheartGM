/**
 * Simiah Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Simiah.md
 */

import { when } from '../engine/when.js';

export const NaturalClimber = {
  name: 'Natural Climber',
  description:
    'You have advantage on Agility Rolls that involve balancing and climbing.',
  advantageTriggers: [
    when(
      (table) => table.action?.trait === 'Agility',
      'Agility Rolls that involve balancing and climbing'
    ),
  ],
};

export const Nimble = {
  name: 'Nimble',
  description: 'You gain +1 to your Evasion.',
  passiveStatMods: {
    evasion: 1,
  },
};
