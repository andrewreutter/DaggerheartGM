/**
 * Adversary action — Siphon Magic (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const SiphonMagic = {
  name: "Siphon Magic",
  type: 'action',
  description: "**Spend a Fear** to make an attack against a PC with a Spellcast trait within Very Close range. On a success, the target marks **1d4** Stress and the Skull clears that many Stress. Additionally, on a success, the Skull can immediately be spotlighted again.",
};
