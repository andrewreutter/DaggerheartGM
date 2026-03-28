/**
 * Adversary action — Perfect Strike (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const PerfectStrike = {
  name: "Perfect Strike",
  type: 'action',
  description: "**Mark a Stress** to make a standard attack against all targets within Very Close range. Targets the Zombie succeeds against are _Vulnerable_ until their next rest.",
};
