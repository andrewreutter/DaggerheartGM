/**
 * Adversary action — Group Attack (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const GroupAttack = {
  name: "Group Attack",
  type: 'action',
  description: "**Spend a Fear** to choose a target and spotlight all Giant Rats within Close range of them. Those Minions move into Melee range of the target and make one shared attack roll. On a success, they deal 1 physical damage each. Combine this damage.",
};
