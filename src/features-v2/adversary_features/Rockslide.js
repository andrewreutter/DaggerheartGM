/**
 * Adversary action — Rockslide (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const Rockslide = {
  name: "Rockslide",
  type: 'action',
  description: "**Mark a Stress** to create a rockslide that buries the land in front of Elemental within Close range with rockfall. All targets in this area must make an Agility Reaction Roll (19). Targets who fail take **2d12+5** physical damage and become _Vulnerable_ until their next roll with Hope. Targets who succeed take half damage.",
};
