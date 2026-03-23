/**
 * SRD consumable — Bridge Seed (common roll table 49).
 * daggerheart-srd/consumables/Bridge Seed.md
 */

/** Euclidean distance in feet between two map positions. Far band is ≤100'. */
function distanceFt(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export const BridgeSeed = {
  name: 'Bridge Seed',
  description:
    'Thick vines grow from your location to a point of your choice within Far range, allowing you to climb up or across them. The vines dissipate on your next rest.',
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
      'Within Far range (≤100 ft) of where you planted the seed',
      'Bridge Seed: climb the vines to your destination — up to Far range (100 ft) from where you planted the seed.'
    );
    table.me.actionLoop(
      'Bridge Seed',
      'Thick vines sprout to a point you choose within Far range (100 ft). Climb along them and place your token there. The vines last until your next rest.'
    );
  },
};
