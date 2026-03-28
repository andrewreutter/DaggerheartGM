/**
 * Adversary action — Mark Target (SRD)
 *
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [EVASION]: Halve target Evasion against stated attacks (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const MarkTarget = {
  name: "Mark Target",
  type: "action",
  description: "**Spend a Fear** to _Mark_ a target within Far range until the Turret is destroyed or the _Marked_ target becomes _Hidden_. While the target is _Marked_, their Evasion is halved.",
};
