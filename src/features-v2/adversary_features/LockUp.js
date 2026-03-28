/**
 * Adversary action — Lock Up (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const LockUp = {
  name: "Lock Up",
  type: 'action',
  description: "**Mark a Stress** to make an attack against a target within Very Close range. On a success, the target is _Restrained_ within the Gaoler until freed with a successful Strength Roll (18). While _Restrained_, the target can only attack the Gaoler.",
};
