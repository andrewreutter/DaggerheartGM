/**
 * Adversary action — Chaotic Flux (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ChaoticFlux = {
  name: "Chaotic Flux",
  type: 'action',
  description: "Make an attack against up to three targets within Very Close range. **Mark a Stress** to deal **2d6+3** magic damage to targets the Hexer succeeded against.",
  adversaryAuraReminder: "Very Close — .",
};
