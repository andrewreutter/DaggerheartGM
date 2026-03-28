/**
 * Adversary action — Enchanting Song (SRD)
 *
 * TODO ACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const EnchantingSong = {
  name: "Enchanting Song",
  type: "action",
  description: "**Spend a Fear** to sing a song that affects all targets within Close range. Targets must succeed on an Instinct Reaction Roll or become _Entranced_ until they mark 2 Stress. Other Sirens within Close range of the target can **mark a Stress** to each add a +1 bonus to the Difficulty of the reaction roll. While _Entranced_, a target can't act and is _Vulnerable_.",
};
