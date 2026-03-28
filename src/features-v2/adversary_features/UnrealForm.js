/**
 * Adversary reaction — Unreal Form (SRD)
 *
 * TODO REACTION [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO REACTION [DAMAGE]: Flat or rolled damage reduction before thresholds (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const UnrealForm = {
  name: "Unreal Form",
  type: 'reaction',
  description: "When the Abomination takes damage, reduce it by **1d20**. If the Abomination marks 1 or fewer Hit Points from a successful attack against them, you gain a Fear.",
};
