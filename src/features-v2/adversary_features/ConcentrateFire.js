/**
 * Adversary reaction — Concentrate Fire (SRD)
 *
 * TODO REACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const ConcentrateFire = {
  name: "Concentrate Fire",
  type: 'reaction',
  description: "When another adversary deals damage to a target within Far range of the Turret, you can **mark a Stress** to add the Turret's standard attack damage to the damage roll.",
};
