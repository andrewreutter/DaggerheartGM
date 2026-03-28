/**
 * Adversary action — Hobbling Shot (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Disadvantage on stated rolls (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const HobblingShot = {
  name: "Hobbling Shot",
  type: 'action',
  description: "Make an attack against a target within Far range. On a success, **mark a Stress** to deal **1d12+3** physical damage. If the target marks HP from this attack, they have disadvantage on Agility Rolls until they clear at least 1 HP.",
};
