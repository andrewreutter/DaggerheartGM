/**
 * Adversary action — Beam of Decay (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const BeamOfDecay = {
  name: "Beam of Decay",
  type: 'action',
  description: "**Mark 2 Stress** to cause all targets within Far range to make a Strength Reaction Roll. Targets who fail take **2d20+12** magic damage and you gain a Fear. Targets who succeed take half damage. A target who marks 2 or more HP must also mark **2 Stress** and becomes _Vulnerable_ until they roll with Hope.",
};
