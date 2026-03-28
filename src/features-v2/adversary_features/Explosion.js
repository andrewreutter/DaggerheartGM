/**
 * Adversary action — Explosion (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [MOVEMENT]: Forced movement range (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Explosion = {
  name: "Explosion",
  type: 'action',
  description: "**Spend a Fear** to erupt in a fiery explosion. Make an attack against all targets within Close range. Targets the Elemental succeeds against take **1d8** magic damage and are knocked back to Far range.",
};
