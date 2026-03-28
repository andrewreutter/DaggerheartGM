/**
 * Adversary action — Suppressing Fire (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const SuppressingFire = {
  name: "Suppressing Fire",
  type: 'action',
  description: "**Mark a Stress** to target a point within Far range. Until the next roll with Fear, a creature who moves within Close range of that point must make an Agility Reaction Roll. On a failure, they take **2d6+3** physical damage. On a success, they take half damage.",
};
