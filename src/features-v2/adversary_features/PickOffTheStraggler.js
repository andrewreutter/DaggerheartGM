/**
 * Adversary action — Pick Off the Straggler (SRD)
 *
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [MOVEMENT]: Teleport timing, range, and costs (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const PickOffTheStraggler = {
  name: "Pick Off the Straggler",
  type: "action",
  description: "**Mark a Stress** to cause a target within Melee range to make an Instinct Reaction Roll. On a failure, the target must mark 2 Stress and is teleported with the Fang to a shadow within Far range, making them temporarily _Vulnerable_. On a success, the target must mark a Stress.",
};
