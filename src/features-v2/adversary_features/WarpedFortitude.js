/**
 * Adversary passive — Warped Fortitude (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const WarpedFortitude = {
  name: "Warped Fortitude",
  type: 'passive',
  description: "The Experiment is resistant to physical damage.",
  damageAffinities: {
    resistances: ['physical'],
  },
};
