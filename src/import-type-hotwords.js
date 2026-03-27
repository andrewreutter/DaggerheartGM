/**
 * Central registry of keyword / regex signals used to guess import destination types
 * from raw OCR or pasted text. Extend per collection as parsers are added.
 *
 * Used by `detectCollection` in text-parse.js and available for UI hints on the client
 * (re-export or duplicate display labels in src/client/lib/import-type-hotwords.js if needed).
 */

/** @typedef {{ id: string, patterns: RegExp[], weight?: number }} HotwordRule */

/** Strong adversary stat-block signals (subset of detectCollection logic). */
export const ADVERSARY_HOTWORD_RULES = /** @type {HotwordRule[]} */ ([
  { id: 'hp', patterns: [/\b(HP|Hit Points?|Stress)\b/i], weight: 1 },
  { id: 'attack', patterns: [/\b(ATK|Attack)\b/i], weight: 1 },
  { id: 'thresholds', patterns: [/\bThresholds?\b/i], weight: 1 },
]);

/** Strong environment signals. */
export const ENVIRONMENT_HOTWORD_RULES = /** @type {HotwordRule[]} */ ([
  { id: 'impulses', patterns: [/\bImpulses?\b/i], weight: 1 },
  { id: 'potential_adversaries', patterns: [/\bPotential\s+Adversar/i], weight: 1 },
]);

/** Placeholder rules for future parsers — document-only for now. */
export const WEAPON_HOTWORD_RULES = /** @type {HotwordRule[]} */ ([
  { id: 'damage', patterns: [/\b\d+d\d+/i, /\bRange\b/i, /\bMelee\b/i], weight: 0.5 },
]);

export const ARMOR_HOTWORD_RULES = /** @type {HotwordRule[]} */ ([
  { id: 'thresholds', patterns: [/\b(Major|Severe)\s+threshold/i], weight: 0.5 },
]);

export const SCENE_HOTWORD_RULES = /** @type {HotwordRule[]} */ ([
  { id: 'battle_budget', patterns: [/\bBattle\s+Points?\b/i, /\bBP\b/i], weight: 0.5 },
]);

/**
 * @param {string} text
 * @param {HotwordRule[]} rules
 * @returns {number}
 */
export function scoreHotwordRules(text, rules) {
  if (!text || !rules?.length) return 0;
  let score = 0;
  for (const rule of rules) {
    const w = rule.weight ?? 1;
    for (const p of rule.patterns) {
      if (p.test(text)) {
        score += w;
        break;
      }
    }
  }
  return score;
}

/**
 * Adversary vs environment signal counts matching legacy `detectCollection` keyword gate.
 * @param {string} text
 * @returns {{ advSignals: number, envSignals: number }}
 */
export function scoreAdversaryVsEnvironmentSignals(text) {
  const adv = scoreHotwordRules(text, ADVERSARY_HOTWORD_RULES);
  const env = scoreHotwordRules(text, ENVIRONMENT_HOTWORD_RULES);
  return { advSignals: adv, envSignals: env };
}
