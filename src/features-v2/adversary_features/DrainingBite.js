/**
 * Adversary action — Draining Bite (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const DrainingBite = {
  name: "Draining Bite",
  type: 'action',
  description: "Make an attack against a target within Melee range. On a success, deal **5d4** physical damage. A target who marks HP from this attack loses a Hope and must mark a Stress. The Vampire then clears a HP.",
};
