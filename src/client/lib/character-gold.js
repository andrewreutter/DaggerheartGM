/**
 * Gold is a single non-negative integer. Digits are denominations (base-10, uncapped):
 *   ones = handfuls, tens = bags, hundreds+ = chests.
 *   465 → 4 chests, 6 bags, 5 handfuls
 */

export function goldToSlots(gold) {
  const g = Math.max(0, Math.floor(gold || 0));
  return {
    chests: Math.floor(g / 100),
    bags: Math.floor(g / 10) % 10,
    handfuls: g % 10,
  };
}

/** SRD: a character "can't have more than 1 chest". Informational only — never blocks input. */
export function isGoldOverSrdCap(gold) {
  return goldToSlots(gold).chests > 1;
}

export function formatGold(gold) {
  const { chests, bags, handfuls } = goldToSlots(gold);
  const parts = [];
  if (chests) parts.push(`${chests} chest${chests !== 1 ? 's' : ''}`);
  if (bags) parts.push(`${bags} bag${bags !== 1 ? 's' : ''}`);
  if (handfuls || !parts.length) parts.push(`${handfuls} handful${handfuls !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

/** Place values for the GM stepper columns. */
export const GOLD_PLACE = {
  handfuls: 1,
  bags: 10,
  chests: 100,
};

/**
 * Add or subtract one column's place value. Floors at 0; carrying/borrowing is ordinary integer math.
 * @param {number} gold
 * @param {1|10|100} place
 * @param {number} delta  typically +1 or -1
 */
export function addGoldPlace(gold, place, delta) {
  const g = Math.max(0, Math.floor(gold || 0));
  const step = Math.floor(Number(place)) || 0;
  const n = Math.floor(Number(delta)) || 0;
  return Math.max(0, g + step * n);
}

/**
 * Parse a gold editor text field. Digits only; empty / non-numeric → 0.
 * @param {string|number|null|undefined} text
 */
export function parseGoldInput(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
