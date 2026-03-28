/**
 * Adversary action — Hobbling Strike (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const HobblingStrike = {
  name: "Hobbling Strike",
  type: 'action',
  description: "**Mark a Stress** to make an attack against a target within Melee range. On a success, deal **3d4+10** direct physical damage and make them _Vulnerable_ until they clear at least 1 HP.",
};
