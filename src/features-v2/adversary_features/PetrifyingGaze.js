/**
 * Adversary reaction — Petrifying Gaze (SRD)
 *
 * TODO REACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO REACTION [COUNTDOWN]: Countdown activation, ticks, maximum value, and trigger effects (per SRD).
 * TODO REACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 * TODO REACTION [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: If the Gorgon is defeated, all petrification countdowns end.
 */
export const PetrifyingGaze = {
  name: "Petrifying Gaze",
  type: 'reaction',
  description: "When the Gorgon takes damage from an attack within Close range, you can **spend a Fear** to force the attacker to make an Instinct Reaction Roll. On a failure, they begin to turn to stone, marking a HP and starting a Petrification Countdown (4). This countdown ticks down when the Gorgon is attacked. When it triggers, the target must make a death move. If the Gorgon is defeated, all petrification countdowns end.",
};
