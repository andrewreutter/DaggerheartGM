/**
 * Adversary passive — Obsidian Scales (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const ObsidianScales = {
  name: "Obsidian Scales",
  type: 'passive',
  description: "The Obsidian Predator is resistant to physical damage.",
  damageAffinities: {
    resistances: ['physical'],
  },
};
