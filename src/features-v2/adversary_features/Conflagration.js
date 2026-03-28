/**
 * Adversary action — Conflagration (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Conflagration = {
  name: "Conflagration",
  type: 'action',
  description: "**Spend a Fear** to unleash an all-consuming firestorm and make an attack against all targets within Close range. Targets the Sorcerer succeeds against take **2d10+6** direct magic damage.",
  adversaryAuraReminder: "Close — .",
};
