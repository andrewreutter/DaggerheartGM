/**
 * Adversary action — Paralyzing Shock (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ParalyzingShock = {
  name: "Paralyzing Shock",
  type: 'action',
  description: "**Mark a Stress** to make a standard attack against all targets within Very Close range. You gain a Fear for each target that marks HP.",
};
