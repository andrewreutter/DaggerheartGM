/**
 * Adversary passive — Ghost (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Physical resistance — registry has `damageAffinities`; ensure damage pipeline applies to adversaries.
 * TODO PASSIVE [MOVEMENT]: Mark Stress to move up to Close range through solid objects (not automated).
 */
export const Ghost = {
  name: "Ghost",
  type: 'passive',
  description: "The Archer has resistance to physical damage. **Mark a Stress** to move up to Close range through solid objects.",
  damageAffinities: {
    resistances: ['physical'],
  },
};
