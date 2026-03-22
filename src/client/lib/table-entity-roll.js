/**
 * Table entity + roll wrappers — canonical copy for Game Table / client code.
 * (Phase D: `src/features/entity.js` and `src/features/roll.js` re-export from here.)
 */
import { extractDetailsValues } from './dice-utils.js';

const noop = () => {};

/**
 * Entity Wrapper — wraps a raw active element + updateActiveElement callback
 * into an object with game-semantic mutator methods.
 */
export function wrapEntity(el, updateActiveElement, options = {}) {
  if (!el) return null;

  const snapshot = {
    currentStress: el.currentStress ?? 0,
    currentHp: el.currentHp ?? el.maxHp ?? 0,
    hope: el.hope ?? el.maxHope ?? 0,
    currentArmor: el.currentArmor ?? 0,
  };

  const entity = {
    ...el,
    instanceId: el.instanceId,
    id: el.instanceId,
    name: el.name,
    class: el.class,
    maxStress: el.maxStress ?? 6,
    maxHp: el.maxHp ?? 0,
    maxHope: el.maxHope ?? 6,
    maxArmor: el.maxArmor ?? 0,

    get currentStress() { return snapshot.currentStress; },
    get currentHp() { return snapshot.currentHp; },
    get hope() { return snapshot.hope; },
    get currentArmor() { return snapshot.currentArmor; },

    markStress(n = 1) {
      if (entity.maxStress <= 0) return;
      snapshot.currentStress = Math.min(snapshot.currentStress + n, entity.maxStress);
      updateActiveElement(el.instanceId, { currentStress: snapshot.currentStress });
    },

    clearStress(n = 1) {
      snapshot.currentStress = Math.max(snapshot.currentStress - n, 0);
      updateActiveElement(el.instanceId, { currentStress: snapshot.currentStress });
    },

    markHp(n = 1) {
      snapshot.currentHp = Math.max(snapshot.currentHp - n, 0);
      updateActiveElement(el.instanceId, { currentHp: snapshot.currentHp });
    },

    clearHp(n = 1) {
      snapshot.currentHp = Math.min(snapshot.currentHp + n, entity.maxHp);
      updateActiveElement(el.instanceId, { currentHp: snapshot.currentHp });
    },

    markArmor(n = 1) {
      snapshot.currentArmor = Math.min(snapshot.currentArmor + n, entity.maxArmor);
      updateActiveElement(el.instanceId, { currentArmor: snapshot.currentArmor });
    },

    clearArmor(n = 1) {
      snapshot.currentArmor = Math.max(snapshot.currentArmor - n, 0);
      updateActiveElement(el.instanceId, { currentArmor: snapshot.currentArmor });
    },

    spendHope(n = 1) {
      snapshot.hope = Math.max(snapshot.hope - n, 0);
      updateActiveElement(el.instanceId, { hope: snapshot.hope });
    },

    gainHope(n = 1) {
      snapshot.hope = Math.min(snapshot.hope + n, entity.maxHope);
      updateActiveElement(el.instanceId, { hope: snapshot.hope });
    },

    hasStress(n = 1) {
      return entity.maxStress - snapshot.currentStress >= n;
    },

    setFlag(key, value) {
      updateActiveElement(el.instanceId, { [key]: value });
    },

    setFeatureUsed(featureKey, cycle) {
      const next = { ...(el.featureUsage || {}), [featureKey]: { used: true, cycle } };
      updateActiveElement(el.instanceId, { featureUsage: next });
    },

    addCondition(name) {
      const existing = el.conditions || '';
      const trimmed = existing.trim();
      const updated = trimmed ? `${trimmed}, ${name}` : name;
      updateActiveElement(el.instanceId, { conditions: updated });
    },

    addResistance(type, source) {
      const list = Array.isArray(el.resistance) ? [...el.resistance] : [];
      const key = source ?? 'Unknown';
      if (!list.some(r => r.type === type && r.source === key)) list.push({ type, source: key });
      updateActiveElement(el.instanceId, { resistance: list });
    },

    removeResistance(type, source) {
      const list = Array.isArray(el.resistance) ? el.resistance : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { resistance: list.filter(r => !(r.type === type && r.source === key)) });
    },

    addModifier(modifier) {
      const id = modifier?.id;
      const existing = (el.activeModifiers || []).filter(m => m.id !== id);
      updateActiveElement(el.instanceId, { activeModifiers: [...existing, modifier] });
    },

    addDisadvantage(source) {
      const list = Array.isArray(el.disadvantageSources) ? [...el.disadvantageSources] : [];
      const key = source ?? 'Unknown';
      if (!list.includes(key)) list.push(key);
      updateActiveElement(el.instanceId, { disadvantageSources: list });
    },

    removeDisadvantage(source) {
      const list = Array.isArray(el.disadvantageSources) ? el.disadvantageSources : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { disadvantageSources: list.filter(s => s !== key) });
    },

    disableMove(source) {
      const list = Array.isArray(el.moveDisabledSources) ? [...el.moveDisabledSources] : [];
      const key = source ?? 'Unknown';
      if (!list.includes(key)) list.push(key);
      updateActiveElement(el.instanceId, { moveDisabledSources: list });
    },

    enableMove(source) {
      const list = Array.isArray(el.moveDisabledSources) ? el.moveDisabledSources : [];
      const key = source ?? 'Unknown';
      updateActiveElement(el.instanceId, { moveDisabledSources: list.filter(s => s !== key) });
    },

    postTraitRoll: typeof options.postTraitRoll === 'function' ? options.postTraitRoll : noop,
    postAction: typeof options.postAction === 'function' ? options.postAction : noop,
  };

  return entity;
}

const TRAIT_NAMES = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

const TRAIT_NAMES_SET = new Set(Object.values(TRAIT_NAMES));

function isTraitOrSpellcastPre(pre) {
  const t = (pre || '').trim();
  if (!t) return false;
  if (/spellcast/i.test(t)) return true;
  return [...TRAIT_NAMES_SET].some(name => t === name || t.endsWith(' ' + name));
}

function isD20SubItem(sub) {
  return sub?.input && /\bd20\b/i.test(sub.input);
}

function isDamageSubItem(sub) {
  return sub && /damage/i.test(sub.pre || '') && sub.input;
}

function wrapSubItem(sub) {
  return {
    ...sub,
    values() {
      return extractDetailsValues(sub.details);
    },
    hasValue(n) {
      return extractDetailsValues(sub.details).some(v => v === n);
    },
  };
}

function getEffectiveSelectedTargetId(roll) {
  return roll._selectedTargetInstanceId ?? (Array.isArray(roll._selectedTargetInstanceIds) && roll._selectedTargetInstanceIds.length > 0 ? roll._selectedTargetInstanceIds[0] : null);
}

export function wrapRoll(roll, displayStore, characterInstanceId) {
  if (!roll) return null;
  const effectiveTargetId = getEffectiveSelectedTargetId(roll);
  const isAttackerMe = characterInstanceId != null && roll._attackerInstanceId === characterInstanceId;
  const isTargetMe = characterInstanceId != null && effectiveTargetId === characterInstanceId;
  const base = {
    ...roll,

    get isWithFear() { return roll.dominant === 'fear'; },
    get isWithHope() { return roll.dominant === 'hope' || roll.dominant === 'critical'; },
    get isReaction() { return !!roll._isReaction; },
    isMine: false,
    get hasDuality() { return roll.dominant != null; },
    get hasDamage() {
      return (roll.subItems || []).some(s => /damage/i.test(s.pre || ''));
    },
    get isSuccess() { return roll.isSuccess ?? false; },
    get isFailure() { return roll._difficulty != null ? !(roll.isSuccess ?? false) : roll.dominant === 'fear'; },
    get hasExperience() { return !!roll._experienceHopeCost; },
    get attackRange() { return roll.attackRange ?? null; },

    get attackRoll() {
      const subs = roll.subItems || [];
      const d20s = subs.filter(isD20SubItem);
      const primary = d20s.find(s => isTraitOrSpellcastPre(s.pre)) ?? d20s[0];
      return primary ? wrapSubItem(primary) : null;
    },

    get damageRoll() {
      const found = (roll.subItems || []).find(isDamageSubItem);
      return found ? wrapSubItem(found) : null;
    },

    isAttacker(character) {
      const id = character?.id ?? character?.instanceId;
      return id != null && this.attacker.id === id;
    },

    isTarget(character) {
      const id = character?.id ?? character?.instanceId;
      return id != null && this.target.id === id;
    },

    isSourceWeapon(source) {
      return roll._weaponId != null && source != null && roll._weaponId === (source?.id ?? source);
    },

    attacker: {
      id: roll._attackerInstanceId ?? null,
      name: roll.rollUser ?? null,
      isMe: isAttackerMe,
    },

    target: {
      id: effectiveTargetId,
      name: roll._selectedTargetName ?? null,
      isMe: isTargetMe,
      get rangeFromMe() { return roll._targetRangeFromMe; },
    },

    get trait() {
      if (roll._traitKey == null) return undefined;
      const name = TRAIT_NAMES[roll._traitKey] ?? roll._traitKey;
      return { name };
    },

    sub(pattern) {
      const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      const found = (roll.subItems || []).find(s => re.test(s.pre || ''));
      return found ? wrapSubItem(found) : null;
    },

    reroll(dieType) {
      if (dieType === 'Hope' || dieType === 'Fear') roll._rerollDie = dieType;
      else if (dieType === 'Duality') roll._rerollDuality = true;
    },

    fullReroll() {
      roll._fullReroll = true;
    },

    reduceHPLoss(n) {
      if (typeof n === 'number' && n > 0) {
        roll._hpLossReduction = (roll._hpLossReduction || 0) + n;
      }
    },

    setDamageTotal(n) {
      const v = Number(n);
      roll._damageTotalOverride = (Number.isNaN(v) || v < 0) ? 0 : Math.ceil(v);
    },
  };

  if (displayStore && roll._rollDbId != null) {
    base.setWithHope = function setWithHope() {
      displayStore[roll._rollDbId] = { ...(displayStore[roll._rollDbId] || {}), dominantForDisplay: 'hope' };
    };
    base.setDominantForDisplay = function setDominantForDisplay(dominant) {
      displayStore[roll._rollDbId] = { ...(displayStore[roll._rollDbId] || {}), dominantForDisplay: dominant };
    };
  }

  return base;
}

export const wrapBanner = wrapRoll;
