/**
 * Adversary passive — Unyielding (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const Unyielding = {
  name: "Unyielding",
  type: 'passive',
  description: "The Legion has resistance to physical damage.",
  damageAffinities: {
    resistances: ['physical'],
  },
};
