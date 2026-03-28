/**
 * Adversary action — Ashen Cloud (SRD)
 *
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [ROLL]: Disadvantage on stated rolls (per SRD).
 * TODO ACTION [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const AshenCloud = {
  name: "Ashen Cloud",
  type: "action",
  description: "**Spend a Fear** to smash the ground and kick up ash within Far range. While within the ash cloud, a target has disadvantage on action rolls. The ash cloud clears the next time an adversary is spotlighted.",
  adversaryAuraReminder: "Far — .",
};
