/**
 * Adversary action — Crown of Serpents (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const CrownOfSerpents = {
  name: "Crown of Serpents",
  type: 'action',
  description: "Make an attack roll against a target within Melee range using the Gorgon's protective snakes. On a success, **mark a Stress** to deal **2d10+4** physical damage and the target must mark a Stress.",
  adversaryAuraReminder: "Melee — using the Gorgon's protective snakes.",
};
