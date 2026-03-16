/**
 * Guardian class features.
 *
 * Hooks implemented:
 *   onHpDealt             — Unstoppable Die increments when the Guardian deals ≥1 HP damage
 *   modifyPreThresholdDamage — Unstoppable Die reduces incoming damage by one severity tier
 */
export default {
  name: 'Guardian',

  /**
   * "Unstoppable" — once per long rest, the Guardian activates their Unstoppable Die
   * (a d4 modifier chip). Each time they deal HP damage the die size increases (d4→d6→d8→d10).
   *
   * Phase 2 note: threshold reduction + Restrained/Vulnerable immunity are also part
   * of the full Unstoppable mechanic (handled here and in resolvedActiveElements display layer).
   */

  /**
   * After the Guardian deals ≥1 HP damage, ratchet their Unstoppable Die up one step.
   * @param {{ character: object, hpDealt: number, updateActiveElement: Function }} ctx
   *   character — wrapped entity (has .class, .activeModifiers, .markStress, etc.)
   */
  onHpDealt({ character, hpDealt, updateActiveElement }) {
    if (hpDealt < 1) return;
    const mods = character.activeModifiers ?? [];
    const modIdx = mods.findIndex(m => m.id?.startsWith('unstoppable-die'));
    if (modIdx === -1) return;

    const mod = mods[modIdx];
    const RATCHET = { d4: 'd6', d6: 'd8', d8: 'd10', d10: 'd10' };
    const next = RATCHET[mod.dice] ?? mod.dice;
    if (next === mod.dice) return; // already at max

    const updated = mods.map((m, i) => i === modIdx ? { ...m, dice: next } : m);
    updateActiveElement(character.instanceId, { activeModifiers: updated });
  },

  /**
   * While the Unstoppable Die modifier chip is active, reduce incoming damage by one
   * severity tier before HP loss is computed.
   *   Severe  → just below Severe threshold  (becomes Major)
   *   Major   → just below Major threshold   (becomes Minor)
   *   Minor   → 0                            (becomes None)
   *
   * @param {number} dmgTotal       — raw incoming damage value
   * @param {{ target: object }} ctx — target is the full character element (has .activeModifiers, .thresholds)
   * @returns {number} adjusted damage total
   */
  modifyPreThresholdDamage(dmgTotal, { target }) {
    if (dmgTotal <= 0) return dmgTotal;
    const active = (target.activeModifiers ?? []).some(m => m.id?.startsWith('unstoppable-die'));
    if (!active) return dmgTotal;

    const thresholds = target.thresholds ?? {};
    const severe = thresholds.severe ?? Infinity;
    const major  = thresholds.major  ?? Infinity;

    if (dmgTotal >= severe) return severe - 1;  // Severe → Major
    if (dmgTotal >= major)  return major  - 1;  // Major  → Minor
    return 0;                                   // Minor  → None
  },
};
