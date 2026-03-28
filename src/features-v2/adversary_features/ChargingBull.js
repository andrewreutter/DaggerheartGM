/**
 * Adversary action — Charging Bull (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [MOVEMENT]: Forced movement range (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ChargingBull = {
  name: "Charging Bull",
  type: 'action',
  description: "**Mark a Stress** to charge through a group within Close range and make an attack against all targets in the Minotaur's path. Targets the Minotaur succeeds against take **2d6+8** physical damage and are knocked back to Very Far range. If a target is knocked into a solid object or another creature, they take an extra **1d6** damage (combine the damage).",
  adversaryAuraReminder: "Close — and make an attack against all targets in the Minotaur's path.",
};
