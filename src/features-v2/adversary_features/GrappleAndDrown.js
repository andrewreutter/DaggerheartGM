/**
 * Adversary action — Grapple and Drown (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const GrappleAndDrown = {
  name: "Grapple and Drown",
  type: 'action',
  description: "Make an attack roll against a target within Close range. On a success, **mark a Stress** to grab them with a tentacle and drag them beneath the water. The target is _Restrained_ and _Vulnerable_ until they break free with a successful Strength Roll or the Kraken takes Major or greater damage. While _Restrained_ and _Vulnerable_ in this way, a target must mark a Stress when they make an action roll.",
};
