/**
 * Adversary action — Blade of the Forest (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const BladeOfTheForest = {
  name: "Blade of the Forest",
  type: 'action',
  description: "**Spend a Fear** to make an attack against all targets within Very Close range. Targets the Knight succeeds against take physical damage equal to **3d4** + the target's Major threshold.",
};
