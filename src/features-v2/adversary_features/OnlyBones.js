/**
 * Adversary passive — Only Bones (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const OnlyBones = {
  name: "Only Bones",
  type: 'passive',
  description: "The Warrior is resistant to physical damage.",
  damageAffinities: {
    resistances: ['physical'],
  },
};
