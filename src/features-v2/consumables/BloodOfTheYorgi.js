/**
 * SRD consumable — Blood of the Yorgi (common roll table 31).
 * daggerheart-srd/consumables/Blood of the Yorgi.md
 */

/** Euclidean distance in feet between two map positions. Very Far band is ≤300'. */
function distanceFt(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export const BloodOfTheYorgi = {
  name: 'Blood of the Yorgi',
  description:
    'You can drink this blood to disappear from where you are and immediately reappear at a point you can see within Very Far range.',
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
        return d != null && d <= 300;
      },
      'Within Very Far range (≤300 ft) of where you drank the blood',
      'Blood of the Yorgi: place your token at a point you can see — up to Very Far range (300 ft) from where you drank the blood.'
    );
    table.me.actionLoop(
      'Blood of the Yorgi',
      'You drink the blood, vanish, and reappear at a point you can see within Very Far range (300 ft). Move your token accordingly.'
    );
  },
};
