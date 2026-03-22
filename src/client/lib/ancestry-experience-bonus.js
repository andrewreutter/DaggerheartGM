/**
 * Experience bonus at character creation (which experience gets +1).
 * Matches SRD + V2 Clank Purposeful Design — only Clank grants this in core rules.
 */

export const ANCESTRY_EXPERIENCE_BONUS_BY_NAME = {
  Clank: { amount: 1, featureName: 'Purposeful Design' },
};

/** SRD feature name → bonus amount (character-calc / completeness; V2 sheet, no Phase 1 registry). */
export const EXPERIENCE_BONUS_BY_FEATURE_NAME = {
  'Purposeful Design': 1,
};

export function getAncestryExperienceBonus(ancestryDisplayName) {
  if (!ancestryDisplayName) return null;
  return ANCESTRY_EXPERIENCE_BONUS_BY_NAME[ancestryDisplayName] ?? null;
}
