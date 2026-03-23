import { getAncestryExperienceBonus } from './ancestry-experience-bonus.js';

/** Matches CharacterDisplay TRAIT_FULL for roll-text insertion */
const TRAIT_LABEL = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hope-cost experience bonus for the active experience id (ancestry bonuses, e.g. Purposeful Design).
 */
export function getExperienceModifierForCharacter(characterEl, activeExpId) {
  const ancestryName = Array.isArray(characterEl?.ancestry) && characterEl.ancestry.length > 0
    ? characterEl.ancestry[0]
    : null;
  const expBonus = ancestryName ? getAncestryExperienceBonus(ancestryName) : null;
  if (!expBonus || !activeExpId) return 2;
  const choice = characterEl.experienceBonusChoices?.[expBonus.featureName];
  return choice === activeExpId ? 2 + expBonus.amount : 2;
}

/**
 * Insert `Name [mod]` after the trait score token (e.g. Agility [3]), or after Fear [d12] if no trait line.
 * Roll text must be built without an experience segment.
 */
export function insertExperienceIntoRollText(rollText, traitKey, expName, mod) {
  if (!expName || mod == null) return rollText;
  const traitLabel = TRAIT_LABEL[traitKey?.toLowerCase?.()] || traitKey;
  const re = new RegExp(`(${escapeRegex(traitLabel)} \\[\\d+\\])`);
  const m = rollText.match(re);
  if (m && m.index !== undefined) {
    const insertAt = m.index + m[1].length;
    return rollText.slice(0, insertAt) + ` ${expName} [${mod}]` + rollText.slice(insertAt);
  }
  const fearMarker = 'Fear [d12]';
  const fearIdx = rollText.indexOf(fearMarker);
  if (fearIdx !== -1) {
    const after = fearIdx + fearMarker.length;
    return rollText.slice(0, after) + ` ${expName} [${mod}]` + rollText.slice(after);
  }
  return rollText;
}
