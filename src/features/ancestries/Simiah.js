/**
 * Simiah ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Simiah resemble anthropomorphic monkeys and apes with long limbs and prehensile feet. All simiah can
 * use their dexterous feet for nonverbal communication, work, and combat. Simiah are skilled climbers. On average,
 * simiah live for about 100 years.
 *
 * SRD (Natural Climber): You have advantage on Agility Rolls that involve balancing and climbing.
 *
 * SRD (Nimble): Gain a permanent +1 bonus to your Evasion at character creation.
 */
export default {
  'Natural Climber': {
    advantageTriggers: ['balancing and climbing'],
  },
  Nimble: {
    passiveStatMods: { evasion: 1 },
  },
};
