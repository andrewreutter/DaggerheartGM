/** Sizes available in the Action Log manual dice builder (must match server `rollDice` support). */
export const MANUAL_DICE_SIZES = [4, 6, 8, 10, 12, 20];

/**
 * @param {boolean} dualityOn
 * @param {Record<number, number>} counts — keyed by die size (e.g. `{ 4: 2 }` for 2d4)
 * @param {number} modifier — flat +/- modifier (e.g. 3 for "2d6+3"), 0 to omit
 */
export function buildManualRollText(dualityOn, counts, modifier = 0) {
  const parts = [];
  if (dualityOn) parts.push('Hope [d12] Fear [d12]');
  for (const size of MANUAL_DICE_SIZES) {
    const n = Number(counts[size]) || 0;
    if (n > 0) parts.push(` [${n}d${size}]`);
  }
  const mod = Number(modifier) || 0;
  if (mod !== 0) parts.push(` Modifier [${mod}]`);
  return parts.join('').trim();
}

/**
 * Pure helper for the manual dice builder's live 3D previews. Returns dice groups
 * (shape expected by `renderColoredDiceGroups` in `dice-color-groups.js`) for whatever
 * would actually be rolled, with each size's preview quantity capped so a large count
 * (e.g. 99) doesn't blow up the physics simulation — the cap is cosmetic only, the real
 * roll always uses the true `counts` value.
 *
 * @param {boolean} dualityOn
 * @param {Record<number, number>} counts — keyed by die size (e.g. `{ 4: 2 }` for 2d4)
 * @param {number} cap — max preview dice per group (default 8)
 * @returns {{ label: string|null, qty: number, sides: number }[]}
 */
export function buildPreviewGroups(dualityOn, counts, cap = 8) {
  const groups = [];
  if (dualityOn) {
    groups.push({ label: 'Hope', qty: 1, sides: 12 });
    groups.push({ label: 'Fear', qty: 1, sides: 12 });
  }
  for (const size of MANUAL_DICE_SIZES) {
    const n = Math.max(0, Number(counts[size]) || 0);
    if (n > 0) groups.push({ label: null, qty: Math.min(n, cap), sides: size });
  }
  return groups;
}
