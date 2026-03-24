/** Sizes available in the Action Log manual dice builder (must match server `rollDice` support). */
export const MANUAL_DICE_SIZES = [4, 6, 8, 10, 12, 20];

/**
 * @param {boolean} dualityOn
 * @param {Record<number, number>} counts — keyed by die size (e.g. `{ 4: 2 }` for 2d4)
 */
export function buildManualRollText(dualityOn, counts) {
  const parts = [];
  if (dualityOn) parts.push('Hope [d12] Fear [d12]');
  for (const size of MANUAL_DICE_SIZES) {
    const n = Number(counts[size]) || 0;
    if (n > 0) parts.push(` [${n}d${size}]`);
  }
  return parts.join('').trim();
}
