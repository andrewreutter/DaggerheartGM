/**
 * Adversary action — Rend Asunder (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [DAMAGE]: “Direct damage” bypasses armor/threshold rules as per SRD table conventions.
 * TODO ACTION [ROLL]: Advantage on stated attacks or rolls (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 */
export const RendAsunder = {
  name: "Rend Asunder",
  type: 'action',
  description: "Make a standard attack with advantage against a target the Zombie has _Restrained_. On a success, the attack deals direct damage.",
};
