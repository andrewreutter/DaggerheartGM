/**
 * Adversary action — Bite (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Bite = {
  name: "Bite",
  type: 'action',
  description: "**Mark a Stress** to make an attack against a target within Melee range. On a success, deal **3d4+10** physical damage and the target is _Restrained_ until they break free with a successful Strength Roll.",
  adversaryAuraReminder: "Melee — .",
};
