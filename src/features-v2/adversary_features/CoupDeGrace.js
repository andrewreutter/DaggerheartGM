/**
 * Adversary action — Coup de Grace (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const CoupDeGrace = {
  name: "Coup de Grace",
  type: 'action',
  description: "**Spend a Fear** to make an attack against a _Vulnerable_ target within Close range. On a success, deal **2d6+12** physical damage and the target must mark a Stress.",
};
