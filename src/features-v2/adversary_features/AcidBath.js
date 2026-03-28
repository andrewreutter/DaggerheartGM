/**
 * Adversary reaction — Acid Bath (SRD)
 *
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const AcidBath = {
  name: "Acid Bath",
  type: 'reaction',
  description: "When the Burrower takes Severe damage, all creatures within Close range are bathed in their acidic blood, taking **1d10** physical damage. This splash covers the ground within Very Close range with blood, and all creatures other than the Burrower who move through it take **1d6** physical damage.",
  adversaryAuraReminder: "Close — are bathed in their acidic blood, taking 1d10 physical damage.",
};
