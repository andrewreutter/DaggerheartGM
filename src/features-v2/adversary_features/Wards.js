/**
 * Adversary passive — Wards (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const Wards = {
  name: "Wards",
  type: 'passive',
  description: "The Skull is resistant to magic damage.",
  damageAffinities: {
    resistances: ['magical'],
  },
};
