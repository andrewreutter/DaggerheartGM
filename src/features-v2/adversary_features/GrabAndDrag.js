/**
 * Adversary action — Grab and Drag (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const GrabAndDrag = {
  name: "Grab and Drag",
  type: 'action',
  description: "Make an attack against a target within Close range. On a success, **spend a Fear** to pull them into Melee range, deal **1d6+2** physical damage, and _Restrain_ them until the Defender takes Severe damage.",
};
