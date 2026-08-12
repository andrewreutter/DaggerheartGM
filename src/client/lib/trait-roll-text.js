/**
 * Duality trait-roll text shared by sheet trait clicks and GM-called reaction Proceed.
 * Hope [d12] / Fear [d12] are separate expressions so the server can detect which die is dominant.
 */

const TRAIT_FULL = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

/**
 * @param {string} charName
 * @param {string} traitKey
 * @param {number} traitScore
 * @param {string | null} [expName]
 * @param {number} [experienceModifier=2]
 * @returns {string}
 */
export function buildTraitRollText(charName, traitKey, traitScore, expName, experienceModifier = 2) {
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${traitName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [${experienceModifier}]`);
  }
  return parts.join(' ');
}
