/**
 * Adversary action — Judgment (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 */
export const Judgment = {
  name: "Judgment",
  type: 'action',
  description: "**Spend a Fear** to make a target _Guilty_ in the eyes of the Seraph's god until the Seraph is defeated. While _Guilty_, the target doesn't gain Hope on a result with Hope. When the Seraph succeeds on a standard attack against a _Guilty_ target, they deal Severe damage instead of their standard damage. The Seraph can only mark one target at a time.",
};
