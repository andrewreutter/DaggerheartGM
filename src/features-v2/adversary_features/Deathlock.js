/**
 * Adversary action — Deathlock (SRD)
 *
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [DAMAGE]: “Direct damage” bypasses armor/threshold rules as per SRD table conventions.
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO ACTION [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: The Hunter can only maintain one Deathlock at a time.
 */
export const Deathlock = {
  name: "Deathlock",
  type: "action",
  description: "**Spend a Fear** to curse a target within Very Close range with a necrotic _Deathlock_ until the end of the scene. Attacks made by the Hunter against a _Deathlocked_ target deal direct damage. The Hunter can only maintain one _Deathlock_ at a time.",
};
