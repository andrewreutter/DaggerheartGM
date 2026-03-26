/**
 * Shared weapon attack roll text builder (Game Table + intent panel rebuild).
 */

import {
  runCharacterHook,
  wrapRoll,
  resolveWeaponTagDescriptor,
  getWeaponTagAutomatedForBanner,
} from './game-table-mechanics.js';

/** Matches CharacterDisplay TRAIT_FULL (no JSX import — safe for Vitest). */
const TRAIT_FULL = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

/** Fallback tag text when merged descriptor omits text (subset of CharacterDisplay WEAPON_TAG_DESCRIPTIONS). */
const WEAPON_TAG_DESCRIPTIONS = {
  Devastating: 'Before an attack roll, mark a Stress to use a d20 as your damage die.',
  Charged: 'Mark a Stress to gain +1 to your Proficiency on a primary weapon attack.',
  'Doubled Up': 'Bonus strike to another Melee target.',
};

function isShowTagFeature(name, characterEl) {
  const d = resolveWeaponTagDescriptor(name, characterEl);
  return d?.showTag === true;
}

function buildFeatureTagText(feature, traits, level, characterEl) {
  const f = resolveWeaponTagDescriptor(feature.name, characterEl);
  if (f) {
    const t = f.tagText;
    if (typeof t === 'function') return t({ traits, level });
    if (typeof t === 'string') return t;
  }
  return feature.text || feature.description || WEAPON_TAG_DESCRIPTIONS[feature.name] || '';
}

/**
 * @param {string} charName
 * @param {string} weaponName
 * @param {string} traitKey
 * @param {number} traitScore
 * @param {string|null} expName
 * @param {string} damageStr
 * @param {object|null} feature
 * @param {object} traits
 * @param {number} level
 * @param {object} opts
 * @param {object} rollMeta
 * @param {object|null} characterEl
 */
export function buildWeaponRollText(
  charName,
  weaponName,
  traitKey,
  traitScore,
  expName,
  damageStr,
  feature,
  traits,
  level,
  opts = {},
  rollMeta = {},
  characterEl = null
) {
  const experienceModifier = opts.experienceModifier ?? 2;
  const traitName = TRAIT_FULL[traitKey] || traitKey;
  const parts = [`${charName} ${weaponName} Hope [d12] Fear [d12]`];
  if (traitScore !== 0) {
    parts.push(`${traitName} [${traitScore}]`);
  }
  if (expName) {
    parts.push(`${expName} [${experienceModifier}]`);
  }

  const featureSet = feature?.name ? [feature.name] : [];
  const rollCtx = { traits, level, opts };

  for (const name of featureSet) {
    const f = resolveWeaponTagDescriptor(name, characterEl);
    const pre = f?.prependRollParts;
    if (Array.isArray(pre) && pre.length) parts.push(...pre);
  }

  if (damageStr) {
    let effectiveDamage = damageStr;
    if (opts.devastating) {
      const dm = damageStr.trim().match(/^(\d*d\d+)([+-]\d+)?(.*)$/i);
      if (dm) effectiveDamage = `d20${dm[2] || ''}${dm[3] || ''}`;
    } else {
      const syntheticRoll = { damageStr, ...rollMeta };
      const wrappedRoll = wrapRoll(syntheticRoll);
      rollCtx.roll = wrappedRoll;
      const weaponRows = (characterEl?.activeFeatures || []).filter(
        (row) => row.type === 'weapon' && featureSet.includes(row.name)
      );
      if (weaponRows.length) {
        runCharacterHook(weaponRows, 'rewriteDamage', rollCtx);
      }
      effectiveDamage = wrappedRoll.damageStr ?? damageStr;
    }
    const m = effectiveDamage.trim().match(/^([^\s]+)(?:\s+(.+))?$/);
    if (m) {
      parts.push(`damage [${m[1]}]`);
      if (m[2]) parts.push(m[2].toLowerCase());
    }
  }

  for (const name of featureSet) {
    const f = resolveWeaponTagDescriptor(name, characterEl);
    const app = f?.appendRollParts;
    if (Array.isArray(app) && app.length) parts.push(...app);
  }

  if (feature && (isShowTagFeature(feature.name, characterEl) || getWeaponTagAutomatedForBanner(feature.name, characterEl))) {
    let tagText;
    if (opts.devastating) {
      tagText = 'd20 damage die, mark 1 Stress (active)';
    } else if (feature.name === 'Doubled Up' && opts.secondaryDamage) {
      tagText = `${opts.secondaryDamage} -- deal to another Melee target`;
    } else {
      tagText = buildFeatureTagText(feature, traits, level, characterEl);
    }
    if (tagText) parts.push(`{${feature.name}: ${tagText}}`);
  }
  return parts.join(' ');
}

/**
 * When Devastating is chosen on the intent surface, rewrite the `damage […]` segment and tag line in an existing roll string.
 */
export function applyDevastatingDamageRewriteToRollText(rollText) {
  if (!rollText || typeof rollText !== 'string') return rollText;
  let t = rollText.replace(/damage \[([^\]]+)\]/i, (match, inner) => {
    const trimmed = String(inner).trim();
    const dm = trimmed.match(/^(\d*d\d+)(.*)$/i);
    if (!dm) return match;
    return `damage [d20${dm[2] || ''}]`;
  });
  t = t.replace(
    /\{Devastating:[^}]+\}/,
    '{Devastating: d20 damage die, mark 1 Stress (active)}'
  );
  return t;
}

/**
 * When Charged is chosen on the intent surface, insert a +1 Proficiency bonus before the damage segment and refresh the tag line.
 */
export function applyChargedProficiencyBonusToRollText(rollText) {
  if (!rollText || typeof rollText !== 'string') return rollText;
  if (/\bCharged\s*\[\+1\]/i.test(rollText)) return rollText;
  let t = rollText.replace(/\bdamage\s*\[/i, 'Charged [+1] damage [');
  t = t.replace(
    /\{Charged:[^}]+\}/,
    '{Charged: +1 Proficiency on this attack (mark 1 Stress)}'
  );
  return t;
}
