/**
 * SRD consumable — Jumping Root (common roll table 17).
 * daggerheart-srd/consumables/Jumping Root.md
 */

/** Euclidean distance in feet between two map positions. Far band is ≤100'. */
function distanceFt(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export const JumpingRoot = {
  name: 'Jumping Root',
  description: 'Eat this root to leap up to Far range once without needing to roll.',
  isDisabled: (table) =>
    table.me.tokenX == null || table.me.tokenY == null
      ? 'Place your token on the map.'
      : false,
  onUse(table) {
    const sx = table.me.tokenX;
    const sy = table.me.tokenY;
    table.me.move(
      (t) => {
        const d = distanceFt(sx, sy, t.me.tokenX, t.me.tokenY);
        return d != null && d <= 100;
      },
      'Within Far range (≤100 ft) of where you ate the root',
      'Jumping Root: leap to your new position — up to Far range (100 ft) from where you ate the root.'
    );
    table.me.actionLoop(
      'Jumping Root',
      'You eat the root and leap. Place your token up to Far range (100 ft) from your starting position — no Agility roll required.'
    );
  },
};
