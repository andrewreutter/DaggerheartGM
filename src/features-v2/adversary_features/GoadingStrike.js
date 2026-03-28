/**
 * Adversary action — Goading Strike (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Disadvantage on stated rolls (per SRD).
 */
export const GoadingStrike = {
  name: "Goading Strike",
  type: 'action',
  description: "Make a standard attack against a target. On a success, **mark a Stress** to _Taunt_ the target until their next successful attack. The next time the _Taunted_ target attacks, they have disadvantage against targets other than the Weaponmaster.",
};
