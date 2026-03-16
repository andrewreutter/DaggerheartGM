/**
 * Rogue class features.
 *
 * Hooks implemented:
 *   computeModifierEligibility — auto-enables Sneak Attack chip when Cloaked or ally in Melee
 *   onDamageReceived           — auto-clears Rogue's Dodge modifier when Rogue takes HP damage
 */

/** Euclidean distance between two placed tokens in feet. Returns Infinity if either is unplaced. */
function distanceFt(tokenA, tokenB, mapConfig) {
  if (tokenA?.tokenX == null || tokenA?.tokenY == null) return Infinity;
  if (tokenB?.tokenX == null || tokenB?.tokenY == null) return Infinity;
  const dx = tokenA.tokenX - tokenB.tokenX;
  const dy = tokenA.tokenY - tokenB.tokenY;
  return Math.sqrt(dx * dx + dy * dy);
}

export default {
  name: 'Rogue',

  /**
   * "Sneak Attack" — the "+{tier}d6" modifier chip is automatically enabled when either:
   *   • The Rogue's condition string contains "Cloaked"
   *   • Any allied character token is within Melee range (≤5 ft) of the Rogue's current target
   *
   * Returns `{ [modId]: boolean }` for each Sneak Attack modifier on the character.
   * The caller (CharacterHoverCard) merges this into modifier chip visibility.
   *
   * @param {{ el: object, activeElements: object[], mapConfig: object }} ctx
   * @returns {Record<string, boolean>}
   */
  computeModifierEligibility({ el, activeElements, mapConfig }) {
    const sneakMods = (el.activeModifiers ?? []).filter(m => m.name === 'Sneak Attack');
    if (!sneakMods.length) return {};

    const cloaked = (el.conditions ?? '').toLowerCase().includes('cloaked');
    if (cloaked) {
      return Object.fromEntries(sneakMods.map(m => [m.id, true]));
    }

    // Check if any allied character token is within Melee range (≤5 ft) of an adversary
    // that the Rogue could plausibly be attacking (nearest adversary with a placed token).
    const placedAllies = activeElements.filter(
      a => a.elementType === 'character' && a.instanceId !== el.instanceId &&
           a.tokenX != null && a.tokenY != null,
    );
    const placedAdversaries = activeElements.filter(
      a => a.elementType !== 'character' && a.tokenX != null && a.tokenY != null,
    );

    // Eligible if any ally is within 5ft of any adversary
    const allyInMelee = placedAllies.some(ally =>
      placedAdversaries.some(adv => distanceFt(ally, adv, mapConfig) <= 5),
    );

    return Object.fromEntries(sneakMods.map(m => [m.id, allyInMelee]));
  },

  /**
   * "Rogue's Dodge" (Hope ability) — adds +2 Evasion as a persistent modifier.
   * Auto-cleared when the Rogue takes ≥1 HP damage.
   *
   * @param {{ character: object, hpLoss: number, updateActiveElement: Function }} ctx
   *   character — the entity that received damage (has .instanceId, .activeModifiers)
   */
  onDamageReceived({ character, hpLoss, updateActiveElement }) {
    if (hpLoss < 1) return;
    const mods = character.activeModifiers ?? [];
    const modIdx = mods.findIndex(m => m.id?.includes('rogues-dodge'));
    if (modIdx === -1) return;

    const updated = mods.filter((_, i) => i !== modIdx);
    updateActiveElement(character.instanceId, { activeModifiers: updated });
  },
};
