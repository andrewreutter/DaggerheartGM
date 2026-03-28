/**
 * Adversary action — Deadly Shot (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const DeadlyShot = {
  name: "Deadly Shot",
  type: 'action',
  description: "Make an attack against a _Vulnerable_ target within Far range. On a success, **mark a Stress** to deal **3d4+8** physical damage.",
};
