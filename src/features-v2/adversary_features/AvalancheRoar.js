/**
 * Adversary action — Avalanche Roar (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO ACTION [ENVIRONMENT]: Environmental hazard damage and Restrained from terrain (per SRD).
 * TODO ACTION [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: The rubble can be cleared with a Progress Countdown (8).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const AvalancheRoar = {
  name: "Avalanche Roar",
  type: 'action',
  description: "**Spend a Fear** to roar while within a cave and cause a cave-in. All targets within Close range must succeed on an Agility Reaction Roll (14) or take **2d10** physical damage. The rubble can be cleared with a Progress Countdown (8).",
};
