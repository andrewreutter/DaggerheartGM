/**
 * Adversary reaction — Volcanic Breath (SRD)
 *
 * TODO REACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO REACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO REACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO REACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO REACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO REACTION [TRIGGER]: Reaction window — detect event, optional costs, then resolve (per SRD).
 */
export const VolcanicBreath = {
  name: "Volcanic Breath",
  type: 'reaction',
  description: "When the Molten Scourge takes Major damage, roll a **d10**. On a result of 8 or higher, the Molten Scourge breathes a flow of lava in front of them within Far range. All targets in that area must make an Agility Reaction Roll. Targets who fail take **2d10+4** physical damage, mark **1d4 Stress**, and are _Vulnerable_ until they clear a Stress. Targets who succeed take half damage and must mark a Stress.",
};
