/**
 * Baseline stat tables and scaling deltas for adversary auto-population.
 * Source: RightKnight's Guide to Making Custom Adversaries v1.6
 * https://freshcutgrass.app/publications/rightknight-s-guide-to-making-custom-adversaries-miuwwac6
 *
 * Baseline values are midpoints (floor) of the ranges given in the guide tables.
 * One representative damage dice pool is chosen per role/tier (middle option from guide).
 * Scaling deltas are additive per tier step: add when going up, subtract when going down.
 *
 * Guide table columns: Difficulty | Major Threshold | Severe Threshold | HP | Stress | ATK | Damage Average | Potential Dice Pools
 * Scaling table columns: Difficulty | Major Threshold | Severe Threshold | HP | Stress | ATK
 */

// These match AdversaryForm's useState initial values for a brand-new adversary.
export const GENERIC_INITIAL_STATS = {
  difficulty: 10,
  hp_max: 6,
  hp_thresholds: { major: 3, severe: 5 },
  stress_max: 4,
  attack: { modifier: 0, damage: '' },
};

/**
 * Baseline stat values by role and tier.
 * Each value is the floor of the midpoint of the guide's range.
 * attack.damage is the middle dice pool option from the guide.
 *
 * Bruiser guide ranges (per tier):
 *   T1: Diff 12-14, Major 7-9,  Severe 13-15, HP 5-7, Stress 3-4, ATK 0-2
 *   T2: Diff 14-16, Major 12-14, Severe 23-26, HP 5-7, Stress 4-6, ATK 2-4
 *   T3: Diff 16-18, Major 19-22, Severe 35-40, HP 6-8, Stress 4-6, ATK 3-5
 *   T4: Diff 18-20, Major 30-37, Severe 63-70, HP 7-9, Stress 4-6, ATK 5-8
 *
 * Horde guide ranges:
 *   T1: Diff 10-12, Major 5-10,  Severe 8-12,  HP 4-6, Stress 2-3, ATK -2-0
 *   T2: Diff 12-14, Major 10-15, Severe 16-20, HP 5-6, Stress 2-3, ATK -1-1
 *   T3: Diff 14-16, Major 15-25, Severe 26-32, HP 6-7, Stress 3-4, ATK 0-2
 *   T4: Diff 16-18, Major 20-30, Severe 35-45, HP 7-8, Stress 4-5, ATK 1-3
 *
 * Leader guide ranges:
 *   T1: Diff 12-14, Major 7-9,  Severe 13-15, HP 5-7, Stress 3-4, ATK 2-4
 *   T2: Diff 14-16, Major 12-14, Severe 23-26, HP 5-7, Stress 4-5, ATK 3-5
 *   T3: Diff 17-19, Major 19-22, Severe 35-40, HP 6-8, Stress 5-6, ATK 5-7
 *   T4: Diff 19-21, Major 30-37, Severe 63-70, HP 7-9, Stress 6-8, ATK 8-10
 *
 * Minion guide ranges (special: no damage thresholds; defeated by any damage):
 *   T1: Diff 10-12, HP 1, Stress 1, ATK -2-0, Damage 1-3
 *   T2: Diff 12-14, HP 1, Stress 1, ATK -1-1, Damage 2-4
 *   T3: Diff 14-16, HP 1, Stress 1-2, ATK 0-2, Damage 5-8
 *   T4: Diff 16-18, HP 1, Stress 1-2, ATK 1-3, Damage 9-12
 *
 * Ranged guide ranges:
 *   T1: Diff 10-12, Major 3-5,  Severe 6-9,  HP 3-4, Stress 2-3, ATK 1-2
 *   T2: Diff 13-15, Major 5-8,  Severe 13-18, HP 3-5, Stress 2-3, ATK 2-5
 *   T3: Diff 15-17, Major 12-15, Severe 25-30, HP 4-6, Stress 3-4, ATK 3-4
 *   T4: Diff 17-19, Major 18-25, Severe 30-40, HP 4-6, Stress 4-5, ATK 4-6
 *
 * Skulk guide ranges:
 *   T1: Diff 10-12, Major 5-7,  Severe 8-12,  HP 3-4, Stress 2-3, ATK 1-2
 *   T2: Diff 12-14, Major 7-9,  Severe 16-20, HP 3-5, Stress 3-4, ATK 2-5
 *   T3: Diff 14-16, Major 15-20, Severe 27-32, HP 4-6, Stress 4-5, ATK 3-7
 *   T4: Diff 16-18, Major 20-30, Severe 35-45, HP 4-6, Stress 4-6, ATK 4-8
 *
 * Social guide ranges (guide notes these are bespoke; no scaling data):
 *   T1: Diff 10-12, Major 3-5,  Severe 6-9,  HP 3, Stress 2-3, ATK -4--1
 *   T2: Diff 13-15, Major 5-8,  Severe 13-18, HP 3, Stress 2-3, ATK -3-0
 *   T3: Diff 15-17, Major 15-20, Severe 27-32, HP 4, Stress 2-3, ATK -2-2
 *   T4: Diff 17-19, Major 25-35, Severe 35-50, HP 4, Stress 2-3, ATK 2-6
 *
 * Solo guide ranges:
 *   T1: Diff 12-14, Major 7-9,  Severe 13-15, HP 8-10, Stress 3-4, ATK 3
 *   T2: Diff 14-16, Major 12-14, Severe 23-26, HP 8-10, Stress 4-5, ATK 3-4
 *   T3: Diff 17-19, Major 19-22, Severe 35-40, HP 10-12, Stress 5-6, ATK 4-7
 *   T4: Diff 19-21, Major 30-37, Severe 63-70, HP 10-12, Stress 6-8, ATK 7-10
 *
 * Standard guide ranges:
 *   T1: Diff 11-13, Major 5-8,  Severe 8-12,  HP 4-5, Stress 3-4, ATK 0-2
 *   T2: Diff 13-15, Major 8-12, Severe 16-20, HP 5-6, Stress 3-4, ATK 1-3
 *   T3: Diff 15-17, Major 15-20, Severe 27-32, HP 5-6, Stress 4-5, ATK 2-4
 *   T4: Diff 17-19, Major 25-35, Severe 35-55, HP 5-6, Stress 4-5, ATK 3-5
 *
 * Support guide ranges:
 *   T1: Diff 12-14, Major 5-8,  Severe 9-12,  HP 3-4, Stress 4-5, ATK 0-2
 *   T2: Diff 13-15, Major 8-12, Severe 16-20, HP 3-5, Stress 4-6, ATK 1-3
 *   T3: Diff 15-17, Major 15-20, Severe 28-35, HP 4-6, Stress 5-6, ATK 2-4
 *   T4: Diff 17-19, Major 20-30, Severe 35-45, HP 4-6, Stress 5-6, ATK 3-5
 */
export const ROLE_STAT_BASELINES = {
  bruiser: {
    1: { difficulty: 13, hp_max: 6,  hp_thresholds: { major: 8,  severe: 14 }, stress_max: 3, attack: { modifier: 1,  damage: '1d10+4'  } },
    2: { difficulty: 15, hp_max: 6,  hp_thresholds: { major: 13, severe: 24 }, stress_max: 5, attack: { modifier: 3,  damage: '2d10+2'  } },
    3: { difficulty: 17, hp_max: 7,  hp_thresholds: { major: 20, severe: 37 }, stress_max: 5, attack: { modifier: 4,  damage: '3d10+4'  } },
    4: { difficulty: 19, hp_max: 8,  hp_thresholds: { major: 33, severe: 66 }, stress_max: 5, attack: { modifier: 6,  damage: '4d10+10' } },
  },
  horde: {
    1: { difficulty: 11, hp_max: 5,  hp_thresholds: { major: 7,  severe: 10 }, stress_max: 2, attack: { modifier: -1, damage: '1d8+3'   } },
    2: { difficulty: 13, hp_max: 5,  hp_thresholds: { major: 12, severe: 18 }, stress_max: 2, attack: { modifier: 0,  damage: '2d8+6'   } },
    3: { difficulty: 15, hp_max: 6,  hp_thresholds: { major: 20, severe: 29 }, stress_max: 3, attack: { modifier: 1,  damage: '3d8+4'   } },
    4: { difficulty: 17, hp_max: 7,  hp_thresholds: { major: 25, severe: 40 }, stress_max: 4, attack: { modifier: 2,  damage: '4d8+8'   } },
  },
  leader: {
    1: { difficulty: 13, hp_max: 6,  hp_thresholds: { major: 8,  severe: 14 }, stress_max: 3, attack: { modifier: 3,  damage: '1d10+3'  } },
    2: { difficulty: 15, hp_max: 6,  hp_thresholds: { major: 13, severe: 24 }, stress_max: 4, attack: { modifier: 4,  damage: '2d10+3'  } },
    3: { difficulty: 18, hp_max: 7,  hp_thresholds: { major: 20, severe: 37 }, stress_max: 5, attack: { modifier: 6,  damage: '3d10+1'  } },
    4: { difficulty: 20, hp_max: 8,  hp_thresholds: { major: 33, severe: 66 }, stress_max: 7, attack: { modifier: 9,  damage: '4d10+8'  } },
  },
  // Minions are defeated by any damage; no thresholds apply. HP=1 by convention.
  minion: {
    1: { difficulty: 11, hp_max: 1,  hp_thresholds: { major: 0,  severe: 0  }, stress_max: 1, attack: { modifier: -1, damage: '2'       } },
    2: { difficulty: 13, hp_max: 1,  hp_thresholds: { major: 0,  severe: 0  }, stress_max: 1, attack: { modifier: 0,  damage: '3'       } },
    3: { difficulty: 15, hp_max: 1,  hp_thresholds: { major: 0,  severe: 0  }, stress_max: 1, attack: { modifier: 1,  damage: '6'       } },
    4: { difficulty: 17, hp_max: 1,  hp_thresholds: { major: 0,  severe: 0  }, stress_max: 1, attack: { modifier: 2,  damage: '10'      } },
  },
  ranged: {
    1: { difficulty: 11, hp_max: 3,  hp_thresholds: { major: 4,  severe: 7  }, stress_max: 2, attack: { modifier: 1,  damage: '1d10+3'  } },
    2: { difficulty: 14, hp_max: 4,  hp_thresholds: { major: 6,  severe: 15 }, stress_max: 2, attack: { modifier: 3,  damage: '2d10+3'  } },
    3: { difficulty: 16, hp_max: 5,  hp_thresholds: { major: 13, severe: 27 }, stress_max: 3, attack: { modifier: 3,  damage: '3d10+1'  } },
    4: { difficulty: 18, hp_max: 5,  hp_thresholds: { major: 21, severe: 35 }, stress_max: 4, attack: { modifier: 5,  damage: '4d10+8'  } },
  },
  skulk: {
    1: { difficulty: 11, hp_max: 3,  hp_thresholds: { major: 6,  severe: 10 }, stress_max: 2, attack: { modifier: 1,  damage: '1d6+2'   } },
    2: { difficulty: 13, hp_max: 4,  hp_thresholds: { major: 8,  severe: 18 }, stress_max: 3, attack: { modifier: 3,  damage: '2d6+3'   } },
    3: { difficulty: 15, hp_max: 5,  hp_thresholds: { major: 17, severe: 29 }, stress_max: 4, attack: { modifier: 5,  damage: '3d6+5'   } },
    4: { difficulty: 17, hp_max: 5,  hp_thresholds: { major: 25, severe: 40 }, stress_max: 5, attack: { modifier: 6,  damage: '4d10+4'  } },
  },
  // Guide notes social adversaries are bespoke; no scaling table is provided.
  social: {
    1: { difficulty: 11, hp_max: 3,  hp_thresholds: { major: 4,  severe: 7  }, stress_max: 2, attack: { modifier: -2, damage: '1d4+1'   } },
    2: { difficulty: 14, hp_max: 3,  hp_thresholds: { major: 6,  severe: 15 }, stress_max: 2, attack: { modifier: -1, damage: '2d6+2'   } },
    3: { difficulty: 16, hp_max: 4,  hp_thresholds: { major: 17, severe: 29 }, stress_max: 2, attack: { modifier: 0,  damage: '3d6+3'   } },
    4: { difficulty: 18, hp_max: 4,  hp_thresholds: { major: 30, severe: 42 }, stress_max: 2, attack: { modifier: 4,  damage: '4d6+4'   } },
  },
  solo: {
    1: { difficulty: 13, hp_max: 9,  hp_thresholds: { major: 8,  severe: 14 }, stress_max: 3, attack: { modifier: 3,  damage: '1d12+2'  } },
    2: { difficulty: 15, hp_max: 9,  hp_thresholds: { major: 13, severe: 24 }, stress_max: 4, attack: { modifier: 3,  damage: '2d10+2'  } },
    3: { difficulty: 18, hp_max: 11, hp_thresholds: { major: 20, severe: 37 }, stress_max: 5, attack: { modifier: 5,  damage: '3d12+6'  } },
    4: { difficulty: 20, hp_max: 11, hp_thresholds: { major: 33, severe: 66 }, stress_max: 7, attack: { modifier: 8,  damage: '4d10+10' } },
  },
  standard: {
    1: { difficulty: 12, hp_max: 4,  hp_thresholds: { major: 6,  severe: 10 }, stress_max: 3, attack: { modifier: 1,  damage: '1d6+2'   } },
    2: { difficulty: 14, hp_max: 5,  hp_thresholds: { major: 10, severe: 18 }, stress_max: 3, attack: { modifier: 2,  damage: '2d6+3'   } },
    3: { difficulty: 16, hp_max: 5,  hp_thresholds: { major: 17, severe: 29 }, stress_max: 4, attack: { modifier: 3,  damage: '3d6+3'   } },
    4: { difficulty: 18, hp_max: 5,  hp_thresholds: { major: 30, severe: 45 }, stress_max: 4, attack: { modifier: 4,  damage: '4d8+4'   } },
  },
  support: {
    1: { difficulty: 13, hp_max: 3,  hp_thresholds: { major: 6,  severe: 10 }, stress_max: 4, attack: { modifier: 1,  damage: '1d6+2'   } },
    2: { difficulty: 14, hp_max: 4,  hp_thresholds: { major: 10, severe: 18 }, stress_max: 5, attack: { modifier: 2,  damage: '2d6+2'   } },
    3: { difficulty: 16, hp_max: 5,  hp_thresholds: { major: 17, severe: 31 }, stress_max: 5, attack: { modifier: 3,  damage: '3d6+3'   } },
    4: { difficulty: 18, hp_max: 5,  hp_thresholds: { major: 25, severe: 40 }, stress_max: 5, attack: { modifier: 4,  damage: '4d8+4'   } },
  },
};

/**
 * Per-tier scaling deltas by role.
 * Key is the TARGET tier (2, 3, or 4); values are the additive deltas when
 * stepping up from the previous tier. Subtract them when stepping down.
 *
 * Guide scaling tables (Difficulty | Major | Severe | HP | Stress | ATK):
 *
 * Bruiser: T1→T2: +2/+5/+10/+1/+2/+2  T2→T3: +2/+7/+15/+1/+0/+2  T3→T4: +2/+12/+25/+1/+0/+2
 * Horde:   T1→T2: +2/+5/+8/+2/+0/+0   T2→T3: +2/+5/+12/+0/+1/+1  T3→T4: +2/+10/+15/+2/+0/+0
 * Leader:  T1→T2: +2/+6/+10/+0/+0/+1  T2→T3: +2/+6/+15/+1/+0/+2  T3→T4: +2/+12/+25/+1/+1/+3
 * Minion:  T1→T2: +2/0/0/0/+0/+1      T2→T3: +2/0/0/0/+1/+1      T3→T4: +2/0/0/0/+0/+1
 * Ranged:  T1→T2: +2/+3/+6/+1/+0/+1   T2→T3: +2/+7/+14/+1/+1/+2  T3→T4: +2/+5/+10/+1/+1/+1
 * Skulk:   T1→T2: +2/+3/+8/+1/+1/+1   T2→T3: +2/+8/+12/+1/+1/+1  T3→T4: +2/+8/+10/+1/+1/+1
 * Solo:    T1→T2: +2/+5/+10/+0/+1/+2  T2→T3: +2/+7/+15/+2/+1/+2  T3→T4: +2/+12/+25/+0/+1/+3
 * Standard:T1→T2: +2/+3/+8/+0/+0/+1   T2→T3: +2/+7/+15/+1/+1/+1  T3→T4: +2/+10/+15/+0/+1/+1
 * Support: T1→T2: +2/+3/+8/+1/+1/+1   T2→T3: +2/+7/+12/+0/+0/+1  T3→T4: +2/+8/+10/+1/+1/+1
 * Social:  (no scaling data — guide says social adversaries are bespoke)
 */
export const ROLE_STAT_SCALING = {
  bruiser: {
    2: { difficulty: 2, major: 5,  severe: 10, hp: 1, stress: 2, atk: 2 },
    3: { difficulty: 2, major: 7,  severe: 15, hp: 1, stress: 0, atk: 2 },
    4: { difficulty: 2, major: 12, severe: 25, hp: 1, stress: 0, atk: 2 },
  },
  horde: {
    2: { difficulty: 2, major: 5,  severe: 8,  hp: 2, stress: 0, atk: 0 },
    3: { difficulty: 2, major: 5,  severe: 12, hp: 0, stress: 1, atk: 1 },
    4: { difficulty: 2, major: 10, severe: 15, hp: 2, stress: 0, atk: 0 },
  },
  leader: {
    2: { difficulty: 2, major: 6,  severe: 10, hp: 0, stress: 0, atk: 1 },
    3: { difficulty: 2, major: 6,  severe: 15, hp: 1, stress: 0, atk: 2 },
    4: { difficulty: 2, major: 12, severe: 25, hp: 1, stress: 1, atk: 3 },
  },
  minion: {
    2: { difficulty: 2, major: 0, severe: 0, hp: 0, stress: 0, atk: 1 },
    3: { difficulty: 2, major: 0, severe: 0, hp: 0, stress: 1, atk: 1 },
    4: { difficulty: 2, major: 0, severe: 0, hp: 0, stress: 0, atk: 1 },
  },
  ranged: {
    2: { difficulty: 2, major: 3, severe: 6,  hp: 1, stress: 0, atk: 1 },
    3: { difficulty: 2, major: 7, severe: 14, hp: 1, stress: 1, atk: 2 },
    4: { difficulty: 2, major: 5, severe: 10, hp: 1, stress: 1, atk: 1 },
  },
  skulk: {
    2: { difficulty: 2, major: 3, severe: 8,  hp: 1, stress: 1, atk: 1 },
    3: { difficulty: 2, major: 8, severe: 12, hp: 1, stress: 1, atk: 1 },
    4: { difficulty: 2, major: 8, severe: 10, hp: 1, stress: 1, atk: 1 },
  },
  solo: {
    2: { difficulty: 2, major: 5,  severe: 10, hp: 0, stress: 1, atk: 2 },
    3: { difficulty: 2, major: 7,  severe: 15, hp: 2, stress: 1, atk: 2 },
    4: { difficulty: 2, major: 12, severe: 25, hp: 0, stress: 1, atk: 3 },
  },
  standard: {
    2: { difficulty: 2, major: 3,  severe: 8,  hp: 0, stress: 0, atk: 1 },
    3: { difficulty: 2, major: 7,  severe: 15, hp: 1, stress: 1, atk: 1 },
    4: { difficulty: 2, major: 10, severe: 15, hp: 0, stress: 1, atk: 1 },
  },
  support: {
    2: { difficulty: 2, major: 3, severe: 8,  hp: 1, stress: 1, atk: 1 },
    3: { difficulty: 2, major: 7, severe: 12, hp: 0, stress: 0, atk: 1 },
    4: { difficulty: 2, major: 8, severe: 10, hp: 1, stress: 1, atk: 1 },
  },
  // Social has no scaling table in the guide.
};

/** Returns the baseline stat object for a role+tier, or null if unavailable. */
export function getBaselineStats(role, tier) {
  return ROLE_STAT_BASELINES[role]?.[tier] ?? null;
}

/**
 * Returns true if the form's numeric combat stats match the guide's baseline
 * for the given role and tier. Used to determine whether stats have been
 * customized away from what was last auto-populated.
 */
export function statsMatchBaseline(formData, role, tier) {
  const baseline = getBaselineStats(role, tier);
  if (!baseline) return false;
  return (
    formData.difficulty === baseline.difficulty &&
    formData.hp_max === baseline.hp_max &&
    (formData.hp_thresholds?.major ?? 0) === baseline.hp_thresholds.major &&
    (formData.hp_thresholds?.severe ?? 0) === baseline.hp_thresholds.severe &&
    formData.stress_max === baseline.stress_max &&
    (formData.attack?.modifier ?? 0) === baseline.attack.modifier &&
    (formData.attack?.damage ?? '') === baseline.attack.damage
  );
}

/**
 * Returns true if the form's numeric combat stats are all at the generic
 * initial values used by AdversaryForm for a brand-new adversary (before any
 * role/tier-based defaults have been applied). The damage field is considered
 * generic when it is empty.
 */
export function statsMatchGenericDefaults(formData) {
  return (
    formData.difficulty === GENERIC_INITIAL_STATS.difficulty &&
    formData.hp_max === GENERIC_INITIAL_STATS.hp_max &&
    (formData.hp_thresholds?.major ?? 0) === GENERIC_INITIAL_STATS.hp_thresholds.major &&
    (formData.hp_thresholds?.severe ?? 0) === GENERIC_INITIAL_STATS.hp_thresholds.severe &&
    formData.stress_max === GENERIC_INITIAL_STATS.stress_max &&
    (formData.attack?.modifier ?? 0) === GENERIC_INITIAL_STATS.attack.modifier &&
    (!formData.attack?.damage || formData.attack.damage === '')
  );
}

/**
 * Applies the guide's per-tier scaling deltas cumulatively from fromTier to
 * toTier (can go up or down). The attack.damage string is replaced with the
 * baseline dice pool for the new tier; all other numeric stats are offset
 * relative to the current values so the user's customizations are preserved.
 *
 * Returns a partial formData-shaped object with only the stat fields updated.
 */
export function computeScaledStats(currentFormData, role, fromTier, toTier) {
  const scaling = ROLE_STAT_SCALING[role];
  const baseline = getBaselineStats(role, toTier);

  // No scaling table for this role (e.g. Social) — fall back to full baseline.
  if (!scaling) return baseline || {};

  const direction = fromTier < toTier ? 1 : -1;
  let difficulty = currentFormData.difficulty ?? 10;
  let major     = currentFormData.hp_thresholds?.major ?? 0;
  let severe    = currentFormData.hp_thresholds?.severe ?? 0;
  let hp        = currentFormData.hp_max ?? 1;
  let stress    = currentFormData.stress_max ?? 1;
  let atk       = currentFormData.attack?.modifier ?? 0;

  let tier = fromTier;
  while (tier !== toTier) {
    const nextTier = tier + direction;
    // The delta key is always the higher of the two consecutive tiers.
    const deltaKey = Math.max(tier, nextTier);
    const delta = scaling[deltaKey];
    if (delta) {
      difficulty += direction * delta.difficulty;
      major      += direction * delta.major;
      severe     += direction * delta.severe;
      hp         += direction * delta.hp;
      stress     += direction * delta.stress;
      atk        += direction * delta.atk;
    }
    tier = nextTier;
  }

  return {
    difficulty: Math.max(1, difficulty),
    hp_max: Math.max(0, hp),
    hp_thresholds: { major: Math.max(0, major), severe: Math.max(0, severe) },
    stress_max: Math.max(0, stress),
    attack: {
      ...(currentFormData.attack || {}),
      modifier: atk,
      // Damage dice scale by tier in ways deltas can't cleanly express;
      // use the baseline pool for the new tier instead.
      damage: baseline?.attack.damage || currentFormData.attack?.damage || '',
    },
  };
}
