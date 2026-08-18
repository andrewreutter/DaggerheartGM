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

function traitLabel(traitKey) {
  if (traitKey == null || traitKey === '') return '';
  const key = String(traitKey).toLowerCase();
  return TRAIT_FULL[key] || String(traitKey);
}

function stripActorPrefix(displayName, actor) {
  const d = String(displayName || '').trim();
  if (!d) return '';
  const name = String(actor || '').trim();
  if (!name || d === name) return d === name ? '' : d;
  if (d.startsWith(name)) {
    return d.slice(name.length).replace(/^\s*[—–:]\s*/, '').trim();
  }
  return d;
}

/**
 * Pre-roll sheet heading: actor plus action/weapon when known, otherwise the trait.
 * @param {object} [opts]
 * @param {string} [opts.actorName]
 * @param {string} [opts.traitKey]
 * @param {string} [opts.displayName]
 * @param {string} [opts.actionName]
 * @param {string} [opts.weaponName]
 * @param {boolean} [opts.isSpellcast]
 * @param {boolean} [opts.isReaction]
 * @param {string} [opts.companionAttackName]
 * @returns {string}
 */
export function buildPreRollPanelTitle({
  actorName,
  traitKey,
  displayName,
  actionName,
  weaponName,
  isSpellcast = false,
  isReaction = false,
  companionAttackName,
} = {}) {
  const actor = String(actorName || '').trim();
  const named = String(companionAttackName || actionName || weaponName || '').trim();
  let action = named;
  if (!action && isReaction) {
    const trait = traitLabel(traitKey);
    action = trait ? `Reaction (${trait})` : 'Reaction';
  }
  if (!action && isSpellcast) action = 'Spellcast';
  if (!action) action = stripActorPrefix(displayName, actor);
  if (!action) action = traitLabel(traitKey);
  if (actor && action) return `${actor} — ${action}`;
  if (actor) return actor;
  if (action) return action;
  return 'Before you roll';
}

/**
 * Action noun for a spotlight-request banner (`Agility`, `Longsword`, feature name).
 * Strips the actor prefix from `displayName` when that is the only hint.
 * @param {object} [opts]
 * @param {string} [opts.actorName]
 * @param {string} [opts.displayName]
 * @param {object} [opts.rollMeta]
 * @returns {string}
 */
export function buildSpotlightRequestActionLabel({ actorName, displayName, rollMeta = {} } = {}) {
  const actor = String(actorName || '').trim();
  const named = String(rollMeta._featureName || '').trim();
  let action = named;
  if (!action && rollMeta._isSpellcastRoll) action = 'Spellcast';
  if (!action) action = stripActorPrefix(displayName, actor);
  if (!action) action = traitLabel(rollMeta._traitKey);
  return action || 'an action';
}

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
