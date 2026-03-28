/**
 * Adversary action — Blizzard Breath (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const BlizzardBreath = {
  name: "Blizzard Breath",
  type: 'action',
  description: "**Spend 2 Fear** to release an icy whorl in front of the Dragon within Close range. All targets in this area must make an Agility Reaction Roll. Targets who fail take **4d6+5** magic damage and are _Restrained_ by ice until they break free with a successful Strength Roll. Targets who succeed must mark 2 Stress or take half damage.",
  adversaryAuraReminder: "Close — .",
};
