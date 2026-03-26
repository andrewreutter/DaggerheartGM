import { resolveRoguesDodgePassiveEvasion } from '../../features-v2/classes/Rogue.js';
import { getV2ToggleStateKey } from '../../features-v2/engine/chip-system.js';
import { getResolvedActiveBeastformBonuses } from './character-calc.js';

export const generateId = () => crypto.randomUUID();

// Returns the initial countdown value from feature description text like "Fear Countdown (8)", or null if none.
export const parseCountdownValue = (text) => {
  if (!text) return null;
  const match = text.match(/\bCountdown\s*\((\d+)\)/i);
  return match ? parseInt(match[1], 10) : null;
};

// Returns all countdown occurrences in text: array of { value, label, index, length }.
// label is the word immediately before "Countdown" (e.g. "Progress"), or "Countdown" if none.
export const parseAllCountdownValues = (text) => {
  if (!text) return [];
  const re = /(?:(\w+)\s+)?Countdown\s*\((\d+)\)/gi;
  const results = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({
      value: parseInt(m[2], 10),
      label: m[1] ? `${m[1]} Countdown` : 'Countdown',
      index: m.index,
      length: m[0].length,
    });
  }
  return results;
};

export const parseFeatureCategory = (feature) => {
  if (!feature.description) return 'Actions';
  const desc = feature.description;
  if (/spend.*fear/i.test(desc) || /mark.*fear/i.test(desc)) return 'Fear Actions';
  if (feature.type === 'reaction') return 'Reactions';
  if (feature.type === 'passive') return 'Passives';
  return 'Actions';
};

export const hideImgOnError = (e) => { e.target.parentElement.style.display = 'none'; };

/** Reference bands for action roll difficulty (5–30). */
const DIFFICULTY_BANDS = [
  { value: 5, label: 'Very Easy' },
  { value: 10, label: 'Easy' },
  { value: 15, label: 'Average' },
  { value: 20, label: 'Hard' },
  { value: 25, label: 'Very Hard' },
  { value: 30, label: 'Nearly Impossible' },
];

/**
 * Returns the qualitative difficulty label for a numeric DC (5–30).
 * For values between bands, returns the nearest band label (e.g. 7 → "Easy").
 */
export function getDifficultyLabel(value) {
  const n = Number(value);
  if (isNaN(n) || n <= 5) return DIFFICULTY_BANDS[0].label;
  if (n >= 30) return DIFFICULTY_BANDS[5].label;
  let best = DIFFICULTY_BANDS[0];
  for (const band of DIFFICULTY_BANDS) {
    if (Math.abs(band.value - n) < Math.abs(best.value - n)) best = band;
  }
  return best.label;
}

/**
 * Daggerheart damage threshold resolution.
 * Returns the number of HP boxes to mark given a raw damage total and thresholds.
 *   < major             → 1 (Minor)
 *   >= major < severe   → 2 (Major)
 *   >= severe           → 3 (Severe), +1 for each doubling beyond severe
 */
export function computeHpLoss(damage, thresholds) {
  const major = thresholds?.major;
  const severe = thresholds?.severe;
  if (severe != null && major != null && severe <= 0 && major <= 0) return damage > 0 ? 1 : 0;
  if (severe != null && damage >= severe) {
    let hp = 3;
    let threshold = severe * 2;
    while (damage >= threshold) {
      hp++;
      threshold *= 2;
    }
    return hp;
  }
  if (major != null && damage >= major) return 2;
  return 1;
}

/**
 * Returns a character's effective Evasion: sheet evasion (including beastform when folded in recompute),
 * optional beastform bonus resolved from SRD when `srdData` is passed and `activeBeastform` has no bonus text,
 * active evasion modifiers (e.g. Timeslowing), and Rogue's Dodge passive.
 * Used for attack roll comparison vs PCs and banner hit/miss.
 *
 * @param {object} el
 * @param {object} [srdData] — pass on the Game Table so beastform id → `evasion_bonus` resolves for hit/miss.
 */
export function effectiveEvasion(el, srdData) {
  if (el == null) return null;
  let bfMod = 0;
  if (!el.evasionIncludesActiveBeastformBonus) {
    if (srdData) {
      const bf = getResolvedActiveBeastformBonuses(el, srdData);
      const p = bf?.evasion_bonus ? parseBeastformBonus(bf.evasion_bonus) : null;
      bfMod = p?.stat === 'evasion' ? p.bonus : 0;
    } else if (el.activeBeastform?.evasion_bonus) {
      const p = parseBeastformBonus(el.activeBeastform.evasion_bonus);
      bfMod = p?.stat === 'evasion' ? p.bonus : 0;
    }
  }
  const base = (el.evasion ?? 0) + bfMod;
  const modBonus = (el.activeModifiers || [])
    .filter((m) => m.type === 'evasion' && m.id !== 'rogues-dodge-evasion')
    .reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  return base + modBonus + resolveRoguesDodgePassiveEvasion(el);
}

/**
 * Parse a beastform stat bonus string like "Agility +1" or "Evasion +2".
 * Returns { stat, bonus } or null if parsing fails.
 */
export function parseBeastformBonus(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\w+)\s*([+-]\d+)$/i);
  if (!m) return null;
  return { stat: m[1].toLowerCase(), bonus: parseInt(m[2], 10) };
}

/**
 * Sum of modifiers shown in parentheses next to Evasion on the sheet (weapon/armor/ancestry/beastform/active chips).
 * The printed base is `el.evasion`; this is the parenthetical bonus total only.
 */
export function getEvasionModifierTotal(el) {
  if (!el) return 0;
  const wm = el.weaponMods || {};
  const am = el.armorMods || {};
  const ancestryEvasion = el.ancestryMods?.evasion ?? 0;
  const bfEvasion = parseBeastformBonus(el.activeBeastform?.evasion_bonus);
  const bfEvasionMod = bfEvasion?.stat === 'evasion' ? bfEvasion.bonus : 0;
  const activeModEvasion = (el.activeModifiers || [])
    .filter((m) => m.type === 'evasion' && m.id !== 'rogues-dodge-evasion')
    .reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const roguesDodgeEvasion = resolveRoguesDodgePassiveEvasion(el);
  return (wm.evasion || 0) + (am.evasion || 0) + ancestryEvasion + bfEvasionMod + activeModEvasion + roguesDodgeEvasion;
}

/**
 * Human-readable breakdown of evasion modifiers (weapon, armor, ancestry, beastform, Rogue's Dodge, active chips).
 * Same text as the Evasion row on the character sheet — use with {@link Tooltip} `content` prop.
 *
 * @returns {string} joined with "; ", or "" when there are no modifier lines
 */
export function formatEvasionModifierTooltip(el) {
  if (!el) return '';
  const wm = el.weaponMods || {};
  const am = el.armorMods || {};
  const ancestryEvasion = el.ancestryMods?.evasion ?? 0;
  const bfEvasion = parseBeastformBonus(el.activeBeastform?.evasion_bonus);
  const bfEvasionMod = bfEvasion?.stat === 'evasion' ? bfEvasion.bonus : 0;
  const parts = [];
  if (wm.evasion) {
    parts.push(
      ...(wm.sources || [])
        .filter((s) => s.stat === 'evasion')
        .map((s) => `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Evasion`),
    );
  }
  if (am.evasion) {
    parts.push(
      ...(am.sources || [])
        .filter((s) => s.stat === 'evasion')
        .map((s) => `${s.feature} (${s.armor}): ${s.value > 0 ? '+' : ''}${s.value} to Evasion`),
    );
  }
  if (ancestryEvasion) {
    const ancestrySourceNames = (el.ancestryMods?.statMods || [])
      .filter((m) => m.stat === 'evasion')
      .map((m) => m.source)
      .filter(Boolean);
    if (ancestrySourceNames.length) {
      parts.push(
        ...ancestrySourceNames.map(
          (name) => `${name}: ${ancestryEvasion > 0 ? '+' : ''}${ancestryEvasion} to Evasion`,
        ),
      );
    } else {
      parts.push(`Ancestry: ${ancestryEvasion > 0 ? '+' : ''}${ancestryEvasion} to Evasion`);
    }
  }
  if (bfEvasionMod) {
    parts.push(
      `Beastform (${el.activeBeastform?.name || 'Beastform'}): ${bfEvasionMod > 0 ? '+' : ''}${bfEvasionMod} to Evasion`,
    );
  }
  const roguesDodgeEva = resolveRoguesDodgePassiveEvasion(el);
  if (roguesDodgeEva) parts.push(`Rogue's Dodge: +${roguesDodgeEva} to Evasion`);
  (el.activeModifiers || [])
    .filter((m) => m.type === 'evasion' && m.id !== 'rogues-dodge-evasion')
    .forEach((m) => {
      const v = m.value ?? 0;
      if (v) parts.push(`${m.name || 'Modifier'}: +${v} to Evasion`);
    });
  return parts.join('; ');
}

/** Tooltip for graphical armor chip — weapon sources that modify Armor Score. */
export function formatArmorChipTooltip(el) {
  const wm = el?.weaponMods || {};
  if (!wm.armorScore) return '';
  return (wm.sources || [])
    .filter((s) => s.stat === 'armor score')
    .map(
      (s) =>
        `${s.feature} (${s.weapon}): ${s.value > 0 ? '+' : ''}${s.value} to Armor Score`,
    )
    .join('; ');
}

/**
 * Tooltip for graphical HP / Stress chips — ancestry (and similar) bonuses to max pools.
 * @param {'maxHp' | 'maxStress'} resourceKey
 */
export function formatStatModsTooltip(el, resourceKey) {
  const am = el?.ancestryMods;
  if (resourceKey === 'maxHp' && am?.maxHp) {
    return `Ancestry: +${am.maxHp} to Max HP`;
  }
  if (resourceKey === 'maxStress' && am?.maxStress) {
    return `Ancestry: +${am.maxStress} to Max Stress`;
  }
  return '';
}

/**
 * Returns a character's effective damage thresholds with their level added to each value.
 * Per Daggerheart rules, characters add their level to their armor's base thresholds.
 * Returns null if the character has no armorThresholds.
 */
export const effectiveThresholds = (el) => {
  if (!el?.armorThresholds) return null;
  const level = el.level ?? 0;
  const reinforced = el.reinforcedActive ? 2 : 0;
  const v2Maj = el._v2MajorThresholdBonus ?? 0;
  const v2Sev = el._v2SevereThresholdBonus ?? 0;
  const ancestryMajor = el.ancestryThresholdMajorBonus ?? el.ancestryThresholdBonus ?? 0;
  const ancestrySevere = el.ancestryThresholdSevereBonus ?? el.ancestryThresholdBonus ?? 0;
  return {
    major: el.armorThresholds.major + level + reinforced + v2Maj + ancestryMajor,
    severe: el.armorThresholds.severe + level + reinforced + v2Sev + ancestrySevere,
  };
};

export const stripHtml = (raw) => {
  if (!raw || !/<[a-z][\s\S]*>/i.test(raw)) return raw || '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Format HP/Stress/Conditions summary for a damage target (character or adversary).
 * Used by target selection popups in ResultBanner and CharacterHoverCard.
 * When opts.hideMax is true (e.g. player view), shows only marked counts (damage taken, stress marked), never max — like the Encounter panel for players.
 * @param {{ currentHp?: number, maxHp?: number, currentStress?: number, maxStress?: number, conditions?: string }} t
 * @param {{ hideMax?: boolean }} [opts]
 * @returns {{ hp: string, stress: string, conditions: string }}
 */
export const formatTargetSummary = (t, opts = {}) => {
  const maxHp = t.maxHp ?? 0;
  const currentHp = t.currentHp ?? maxHp;
  const maxStress = t.maxStress ?? 0;
  const currentStress = t.currentStress ?? 0;
  const raw = (t.conditions ?? '').trim();
  const conditions = raw.length > 40 ? raw.slice(0, 37) + '...' : raw;

  if (opts.hideMax) {
    const hpMarked = Math.max(0, maxHp - currentHp);
    const hp = `${hpMarked} HP`;
    const stress = maxStress > 0 ? `${currentStress} Stress` : '';
    return { hp, stress, conditions };
  }

  const hp = `${currentHp}/${maxHp} HP`;
  const stress = maxStress > 0 ? `${currentStress}/${maxStress} Stress` : '';
  return { hp, stress, conditions };
};

/**
 * True when an adversary instance has all HP marked (defeated).
 * Uses hp_max and currentHp (currentHp defaults to hp_max when omitted).
 * @param {{ hp_max?: number, currentHp?: number }} element - adversary base or instance with hp_max; instance has currentHp
 */
export function isAdversaryDefeated(element) {
  const maxHp = element.hp_max ?? 0;
  const currentHp = element.currentHp ?? element.hp_max ?? 0;
  return maxHp > 0 && currentHp <= 0;
}

/**
 * Winged Sentinel — Wings of Light: flying from `featureState.WingedSentinel` (`_v2t` toggle key).
 */
export function isWingsOfLightFlying(el) {
  if (!el || typeof el !== 'object') return false;
  const ws = el.featureState?.WingedSentinel;
  if (!ws || typeof ws !== 'object') return false;
  const k = getV2ToggleStateKey(
    { name: 'Wings of Light' },
    { name: 'Flying', placements: ['card'] },
    null,
  );
  return ws[k] === true;
}

/**
 * Pending deferred V2 card chip toggle (`gameTableDeferUntilBannerAck` + `isToggle`): tentative on/off until GM ack.
 * Matches banners with `_v2DeferUntilBannerAck`, `_v2DeferFeatureName`, `_v2DeferChipName`, `_v2DeferToggleNext`.
 * @returns {boolean|undefined} — tentative next `isOn`; `undefined` = no matching pending banner
 */
export function getPendingV2DeferToggleNext(pendingBanners, instanceId, featureName, chipName) {
  if (instanceId == null || instanceId === '' || !Array.isArray(pendingBanners)) return undefined;
  if (!featureName || chipName == null || chipName === '') return undefined;
  const sid = String(instanceId);
  const fn = String(featureName);
  const cn = String(chipName);
  let last;
  for (const r of pendingBanners) {
    if (!r?._action) continue;
    if (String(r._attackerInstanceId ?? '') !== sid) continue;
    let nextBool;
    if (r._v2DeferUntilBannerAck === true && typeof r._v2DeferToggleNext === 'boolean') {
      if (String(r._v2DeferFeatureName ?? r._featureName ?? r.actionName ?? '') !== fn) continue;
      if (String(r._v2DeferChipName ?? '') !== cn) continue;
      nextBool = r._v2DeferToggleNext;
    } else if (r._wingsOfLightFlightDefer === true && fn === 'Wings of Light' && (cn === 'Flight' || cn === 'Flying')) {
      nextBool = r._wingsOfLightFlightNext === true;
    } else {
      continue;
    }
    last = nextBool;
  }
  return last;
}

/** @deprecated Use {@link getPendingV2DeferToggleNext} with `'Wings of Light'` and `'Flying'`. */
export function getPendingWingsOfLightFlightNext(pendingBanners, instanceId) {
  return getPendingV2DeferToggleNext(pendingBanners, instanceId, 'Wings of Light', 'Flying');
}
