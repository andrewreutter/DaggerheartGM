/**
 * Adversary action — Hail of Boulders (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const HailOfBoulders = {
  name: "Hail of Boulders",
  type: 'action',
  description: "**Mark a Stress** to pick up heavy objects and throw them at all targets in front of the Ogre within Far range. Make an attack against these targets. Targets the Ogre succeeds against take **1d10+2** physical damage. If they succeed against more than one target, you gain a Fear.",
};
