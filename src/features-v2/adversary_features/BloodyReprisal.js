/**
 * Adversary reaction — Bloody Reprisal (SRD)
 *
 * TODO REACTION [DAMAGE]: Replace standard attack damage with stated dice under condition (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 * TODO REACTION [ATTACK]: Roll / apply standard attack from statblock (`adversary-roll-descriptors.js`).
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const BloodyReprisal = {
  name: "Bloody Reprisal",
  type: 'reaction',
  description: "When the Brawler marks 2 or more HP from an attack within Very Close range, you can make a standard attack against the attacker. On a success, the Brawler deals **2d6+15** physical damage instead of their standard damage.",
};
