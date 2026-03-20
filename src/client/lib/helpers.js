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
 * Returns a character's effective Evasion including runtime modifiers (e.g. Timeslowing +1d4).
 * Used for attack roll comparison and display when activeModifiers include type 'evasion'.
 */
export function effectiveEvasion(el) {
  if (el == null) return null;
  const base = el.evasion ?? 0;
  const modBonus = (el.activeModifiers || [])
    .filter(m => m.type === 'evasion')
    .reduce((sum, m) => sum + (m.value ?? 0), 0);
  return base + modBonus;
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
  const elementalBonus = el.activeChanneledElement === 'earth' ? (el.proficiency ?? 0) : 0;
  const ancestryMajor = el.ancestryThresholdMajorBonus ?? el.ancestryThresholdBonus ?? 0;
  const ancestrySevere = el.ancestryThresholdSevereBonus ?? el.ancestryThresholdBonus ?? 0;
  return {
    major: el.armorThresholds.major + level + reinforced + elementalBonus + ancestryMajor,
    severe: el.armorThresholds.severe + level + reinforced + elementalBonus + ancestrySevere,
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
