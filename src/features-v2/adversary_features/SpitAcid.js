/**
 * Adversary action — Spit Acid (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO ACTION [ARMOR]: Target marks Armor Slot without benefit; if they cannot, mark extra HP instead (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const SpitAcid = {
  name: "Spit Acid",
  type: 'action',
  description: "Make an attack against all targets in front of the Burrower within Close range. Targets the Burrower succeeds against take **2d6** physical damage and must mark an Armor Slot without receiving its benefits (they can still use armor to reduce the damage). If they can't mark an Armor Slot, they must mark an additional HP and you gain a Fear.",
};
