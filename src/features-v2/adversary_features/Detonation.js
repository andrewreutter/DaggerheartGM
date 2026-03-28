/**
 * Adversary reaction — Detonation (SRD)
 *
 * TODO REACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO REACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 * TODO REACTION [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: When the Turret is destroyed, they explode.
 */
export const Detonation = {
  name: "Detonation",
  type: 'reaction',
  description: "When the Turret is destroyed, they explode. All targets within Close range must make an Agility Reaction Roll. Targets who fail take **3d20** physical damage. Targets who succeed take half damage.",
};
