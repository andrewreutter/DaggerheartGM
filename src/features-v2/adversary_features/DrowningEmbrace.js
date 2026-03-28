/**
 * Adversary action — Drowning Embrace (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const DrowningEmbrace = {
  name: "Drowning Embrace",
  type: 'action',
  description: "**Spend a Fear** to make an attack against all targets within Very Close range. Targets the Elemental succeeds against become _Restrained_ and _Vulnerable_ as they begin drowning. A target can break free, ending both conditions, with a successful Strength or Instinct Roll.",
};
