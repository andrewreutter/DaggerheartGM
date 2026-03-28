/**
 * Adversary passive — Arcane Form (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).
 */
export const ArcaneForm = {
  name: "Arcane Form",
  type: 'passive',
  description: "The Elemental is resistant to magic damage.",
  damageAffinities: {
    resistances: ['magical'],
  },
};
