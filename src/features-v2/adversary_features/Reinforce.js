/**
 * Adversary action — Reinforce (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Reinforce = {
  name: "Reinforce",
  type: 'action',
  description: "**Mark a Stress** to move into Melee range of an ally and make a standard attack against a target within Very Close range. On a success, deal **2d10+2** physical damage and the ally can clear a Stress.",
};
