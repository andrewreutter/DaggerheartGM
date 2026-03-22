/**
 * Bone domain — Untouchable (Tier 1)
 * SRD: Gain a bonus to your Evasion equal to half your Agility.
 */

export const Untouchable = {
  name: 'Untouchable',
  description:
    'Gain a bonus to your Evasion equal to half your Agility.',
  passiveStatMods: {
    evasion: (table) => Math.floor((table.me?.traits?.agility ?? 0) / 2),
  },
};
