/**
 * Adversary reaction — Split (SRD)
 *
 * TODO REACTION [FEAR_SPEND]: GM spends Fear — wire to Fear track + spotlight/ability costs (per SRD line).
 * TODO REACTION [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const Split = {
  name: "Split",
  type: 'reaction',
  description: "When the Ooze has 3 or more HP marked, you can **spend a Fear** to split them into two Tiny Green Oozes (with no marked HP or Stress). Immediately spotlight both of them.",
};
