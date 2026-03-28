/**
 * Adversary reaction — Blood in the Water (SRD)
 *
 * TODO REACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO REACTION [SPOTLIGHT]: Spotlight/Fear interactions (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const BloodInTheWater = {
  name: "Blood in the Water",
  type: 'reaction',
  description: "When a creature within Close range of the Shark marks HP from another creature's attack, you can **mark a Stress** to immediately spotlight the Shark, moving them into Melee range of the target and making a standard attack.",
  adversaryAuraReminder: "Close — of the Shark marks HP from another creature's attack, you can mark a Stress to immediately spotlight the Shark, moving them into Melee range of the target and making a standard attack.",
};
