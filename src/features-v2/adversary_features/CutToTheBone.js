/**
 * Adversary action — Cut to the Bone (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const CutToTheBone = {
  name: "Cut to the Bone",
  type: 'action',
  description: "**Mark a Stress** to make an attack against all targets within Very Close range. Targets the Knight succeeds against take **1d8+2** physical damage and must mark a Stress.",
};
