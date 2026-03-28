/**
 * Adversary reaction — Warding Sphere (SRD)
 *
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const WardingSphere = {
  name: "Warding Sphere",
  type: 'reaction',
  description: "When the Wizard takes damage from an attack within Close range, deal **2d6** magic damage to the attacker. This reaction can't be used again until the Wizard refreshes it with their \"Refresh Warding Sphere\" action.",
};
