/**
 * Adversary action — Hold Them Down (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const HoldThemDown = {
  name: "Hold Them Down",
  type: 'action',
  description: "Make an attack against a target within Melee range. On a success, the target takes no damage but is _Restrained_ and _Vulnerable_. The target can break free, clearing both conditions, with a successful Strength Roll or is freed automatically if the Kneebreaker takes Major or greater damage.",
};
