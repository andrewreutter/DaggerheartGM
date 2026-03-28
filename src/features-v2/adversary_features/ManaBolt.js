/**
 * Adversary action — Mana Bolt (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [MOVEMENT]: Forced movement range (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ManaBolt = {
  name: "Mana Bolt",
  type: 'action',
  description: "**Spend a Fear** to lob explosive magic at a point within Far range. All targets within Very Close range of that point must make an Agility Reaction Roll. Targets who fail take **2d8+20** magic damage and are knocked back to Close range. Targets who succeed take half damage and aren't knocked back.",
};
