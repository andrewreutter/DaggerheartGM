/**
 * Helpers for persisting `setRollOutcome` (Fearless, Midnight-Touched, Stealth Expertise, etc.)
 * and one-shot review-chip consumption onto the pending `dice_rolls` row so every client
 * (GM + players) sees the same Hope/Fear banner and Acknowledge uses the converted outcome.
 *
 * Fields stored on the roll JSON:
 *   `_v2ActionRollOutcome`    — `'hope' | 'fear'` explicit outcome override
 *   `_v2ReviewChipsConsumed`  — `string[]` of `v2BannerChipActivationKey` values
 */

const VALID_OUTCOMES = new Set(['hope', 'fear']);

/**
 * Merge an outcome override and/or a consumed-chip activation key into an existing roll data
 * object, returning a patch object suitable for `updateDiceRollData`.
 *
 * Rules:
 *  - `outcome`: last-write-wins (the most recent chip use is authoritative).
 *  - `consumedActivationKey`: accumulated into an array; duplicates are silently ignored.
 *  - An `undefined` / null argument means "no change for that field".
 *
 * @param {object} existingData   — current `dice_rolls.data` for the banner
 * @param {{ outcome?: string, consumedActivationKey?: string }} opts
 * @returns {object}  patch object (may be empty `{}` when nothing changed)
 */
export function buildV2ReviewChipBannerPatch(existingData, { outcome, consumedActivationKey } = {}) {
  const patch = {};

  if (outcome != null && VALID_OUTCOMES.has(outcome)) {
    patch._v2ActionRollOutcome = outcome;
  }

  if (consumedActivationKey != null && typeof consumedActivationKey === 'string' && consumedActivationKey !== '') {
    const prev = Array.isArray(existingData?._v2ReviewChipsConsumed)
      ? existingData._v2ReviewChipsConsumed
      : [];
    if (!prev.includes(consumedActivationKey)) {
      patch._v2ReviewChipsConsumed = [...prev, consumedActivationKey];
    }
  }

  return patch;
}

/**
 * Resolve the effective Duality dominant for display and Ack.
 *
 * - If `_v2ActionRollOutcome` is set on the roll, it wins.
 * - Otherwise fall back to `roll.dominant`.
 * - A Duality `'critical'` is left alone unless the feature explicitly set `'fear'`.
 *   (A critical is still a critical — it is "with Hope" for all practical purposes.)
 *
 * @param {object} roll
 * @returns {'hope' | 'fear' | 'critical' | string | undefined}
 */
export function resolveBannerActionDominant(roll) {
  if (!roll) return undefined;
  const override = roll._v2ActionRollOutcome;
  if (override === 'hope' || override === 'fear') {
    // If the roll was a Critical but we're overriding to 'hope', keep 'critical' (it's still a crit).
    // Only downgrade a Critical when a feature explicitly sets 'fear'.
    if (roll.dominant === 'critical' && override === 'hope') {
      return 'critical';
    }
    return override;
  }
  return roll.dominant;
}

/**
 * Return a `Set<string>` of consumed chip activation keys from the banner's persisted field.
 *
 * @param {object} roll
 * @returns {Set<string>}
 */
export function consumedActivationKeysFromBanner(roll) {
  const arr = roll?._v2ReviewChipsConsumed;
  if (!Array.isArray(arr) || arr.length === 0) return new Set();
  return new Set(arr.filter((k) => typeof k === 'string' && k !== ''));
}

/**
 * Extract a `setRollOutcome` outcome value from a list of `engineRollDisplayOnly` mutations,
 * restricted to the `action` roll key (Fearless, Midnight-Touched, Stealth Expertise).
 *
 * @param {object[]} engineRollDisplayOnly
 * @returns {'hope' | 'fear' | null}
 */
export function extractActionRollOutcomeFromDisplayMutations(engineRollDisplayOnly) {
  if (!Array.isArray(engineRollDisplayOnly)) return null;
  for (const m of engineRollDisplayOnly) {
    if (
      m?.type === 'setRollOutcome' &&
      m.payload?.rollKey === 'action' &&
      VALID_OUTCOMES.has(m.payload?.outcome)
    ) {
      return m.payload.outcome;
    }
  }
  return null;
}
