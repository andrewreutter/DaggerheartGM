/**
 * Rogue class features — per-feature descriptors.
 *
 * SRD (class): Rogues are scoundrels, often in both attitude and practice. Utilizing their sharp wits and blades, rogues
 * trick their foes through social manipulation as easily as breaking locks, climbing through windows, or dealing
 * underhanded blows.
 *
 * SRD (Cloaked): Any time you would be _Hidden,_ you are instead _Cloaked._ While _Cloaked_ you remain unseen if you are
 * stationary when an adversary moves to where they would normally see you. After you make an attack or end a move
 * within line of sight of an adversary, you are no longer _Cloaked_.
 *
 * SRD (Sneak Attack): When you succeed on an attack while _Cloaked_ or while an ally is within Melee range of your
 * target, add a number of **d6s** equal to your tier to your damage roll.
 *
 * SRD (Rogue's Dodge, Hope): **Spend 3 Hope** to gain a +2 bonus to your Evasion until the next time an attack succeeds
 * against you. Otherwise, this bonus lasts until your next rest.
 *
 * Implementation: Sneak Attack — computeModifierEligibility enable chip when Cloaked or ally in Melee. Rogue's Dodge —
 * onDamageReceived clear modifier when Rogue takes HP damage.
 */

/** Euclidean distance between two placed tokens in feet. Returns Infinity if either is unplaced. */
function distanceFt(tokenA, tokenB) {
  if (tokenA?.tokenX == null || tokenA?.tokenY == null) return Infinity;
  if (tokenB?.tokenX == null || tokenB?.tokenY == null) return Infinity;
  const dx = tokenA.tokenX - tokenB.tokenX;
  const dy = tokenA.tokenY - tokenB.tokenY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** @type {Record<string, object>} */
const features = {
  'Sneak Attack': {
    name: 'Sneak Attack',
    class: 'Rogue',
    computeModifierEligibility({ el, activeElements }) {
      const sneakMods = (el.activeModifiers ?? []).filter(m => m.name === 'Sneak Attack');
      if (!sneakMods.length) return {};

      const cloaked = (el.conditions ?? '').toLowerCase().includes('cloaked');
      if (cloaked) {
        return Object.fromEntries(sneakMods.map(m => [m.id, true]));
      }

      const placedAllies = activeElements.filter(
        a => a.elementType === 'character' && a.instanceId !== el.instanceId &&
             a.tokenX != null && a.tokenY != null,
      );
      const placedAdversaries = activeElements.filter(
        a => a.elementType !== 'character' && a.tokenX != null && a.tokenY != null,
      );

      const allyInMelee = placedAllies.some(ally =>
        placedAdversaries.some(adv => distanceFt(ally, adv) <= 5),
      );

      return Object.fromEntries(sneakMods.map(m => [m.id, allyInMelee]));
    },
  },

  "Rogue's Dodge": {
    name: "Rogue's Dodge",
    class: 'Rogue',
    onDamageReceived({ character, hpLoss, updateActiveElement }) {
      if (hpLoss < 1) return;
      const mods = character.activeModifiers ?? [];
      const modIdx = mods.findIndex(m => m.id?.includes('rogues-dodge'));
      if (modIdx === -1) return;

      const updated = mods.filter((_, i) => i !== modIdx);
      updateActiveElement(character.instanceId, { activeModifiers: updated });
    },
  },
};

export default features;
