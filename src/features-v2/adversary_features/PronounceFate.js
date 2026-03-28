/**
 * Adversary action — Pronounce Fate (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [RESOURCE]: PC Hope loss (per SRD trigger).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const PronounceFate = {
  name: "Pronounce Fate",
  type: 'action',
  description: "**Spend a Fear** to present a target within Far range with a vision of their personal nightmare. The target must make a Knowledge Reaction Roll. On a failure, they lose all Hope and take **2d20+4** direct magic damage. On a success, they take half damage and lose a Hope.",
};
