/**
 * Adversary action — Focused Volley (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [ROLL]: Advantage on stated attacks or rolls (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const FocusedVolley = {
  name: "Focused Volley",
  type: 'action',
  description: "**Spend a Fear** to target a point within Far range. Make an attack with advantage against all targets within Close range of that point. Targets the Squadron succeeds against take **1d10+4** physical damage.",
};
