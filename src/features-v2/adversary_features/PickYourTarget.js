/**
 * Adversary action — Pick Your Target (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const PickYourTarget = {
  name: "Pick Your Target",
  type: 'action',
  description: "**Spend a Fear** to make an attack within Far range against a PC who is within Very Close range of at least two other PCs. On a success, the target takes **2d8+12** physical damage.",
};
