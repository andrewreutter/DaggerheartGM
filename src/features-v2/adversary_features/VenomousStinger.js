/**
 * Adversary action — Venomous Stinger (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const VenomousStinger = {
  name: "Venomous Stinger",
  type: 'action',
  description: "Make an attack against a target within Very Close range. On a success, **spend a Fear** to deal **1d4+4** physical damage and _Poison_ them until their next rest or they succeed on a Knowledge Roll (16). While _Poisoned_, the target must roll a **d6** before they make an action roll. On a result of 4 or lower, they must mark a Stress.",
};
