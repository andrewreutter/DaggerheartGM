/**
 * Hex fills for server-side table preview tokens.
 * Mirrors BattleMap.jsx `ADVERSARY_ROLE_TOKEN_CLASSES` / `ALLY_TOKEN_PALETTE` Tailwind hues.
 */

export const ADVERSARY_ROLE_TOKEN_HEX = {
  solo: '#991b1b',      // red-800
  bruiser: '#c2410c',   // orange-700
  standard: '#92400e',  // amber-800
  leader: '#eab308',    // yellow-500
  ranged: '#84cc16',    // lime-500
  skulk: '#6d28d9',     // violet-700
  horde: '#9333ea',     // purple-600
  support: '#d946ef',   // fuchsia-500
  social: '#ec4899',    // pink-500
  minion: '#fb7185',    // rose-400
};

export const ALLY_TOKEN_PALETTE_HEX = [
  '#0284c7', // sky-600
  '#059669', // emerald-600
  '#22d3ee', // cyan-400
  '#1d4ed8', // blue-700
  '#14b8a6', // teal-500
  '#16a34a', // green-600
  '#60a5fa', // blue-400
  '#115e59', // teal-800
  '#166534', // green-800
  '#0e7490', // cyan-700
];

export const COMPANION_TOKEN_HEX = '#064e3b'; // emerald-900
export const DEFEATED_TOKEN_HEX = '#000000';

/**
 * @param {object} element
 * @param {number} [allyIndex]
 * @returns {string} css hex
 */
export function tokenPreviewFillHex(element, allyIndex = 0) {
  if (!element) return ADVERSARY_ROLE_TOKEN_HEX.standard;
  if (element.elementType === 'boardToken') return COMPANION_TOKEN_HEX;
  if (element.elementType === 'character') {
    const i = Number.isFinite(allyIndex) ? Math.max(0, allyIndex) : 0;
    return ALLY_TOKEN_PALETTE_HEX[i % ALLY_TOKEN_PALETTE_HEX.length];
  }
  if (element.elementType === 'adversary') {
    const maxHp = element.hp_max ?? 0;
    const currentHp = element.currentHp ?? element.hp_max ?? 0;
    if (maxHp > 0 && currentHp <= 0) return DEFEATED_TOKEN_HEX;
    return ADVERSARY_ROLE_TOKEN_HEX[element.role] || ADVERSARY_ROLE_TOKEN_HEX.standard;
  }
  return ADVERSARY_ROLE_TOKEN_HEX.standard;
}
