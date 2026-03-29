/**
 * Adversary action — Box In (SRD)
 *
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Disadvantage on stated rolls (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const BoxIn = {
  name: "Box In",
  type: "action",
  description: "**Mark a Stress** to choose a target within Very Close range to focus on. That target has disadvantage on attack rolls when they're within Very Close range of the Sentinel. The Sentinel can only focus on one target at a time.",
};
