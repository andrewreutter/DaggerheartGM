import { computeHpLoss } from './helpers.js';

/**
 * Default HP (or companion Stress) the GM will apply on Ack for one target.
 * A known miss starts at 0 so the GM can leave it (old Skip) or bump it up.
 *
 * @param {{
 *   displayDmg?: number,
 *   thresholds?: { major?: number, severe?: number } | null,
 *   isMiss?: boolean,
 *   isCompanion?: boolean,
 * }} [opts]
 * @returns {number}
 */
export function defaultBannerTargetHpLoss(opts = {}) {
  if (opts.isCompanion) return opts.isMiss ? 0 : 1;
  if (opts.isMiss) return 0;
  const dmg = Number(opts.displayDmg);
  if (!Number.isFinite(dmg) || dmg <= 0) return 0;
  return computeHpLoss(dmg, opts.thresholds);
}

/**
 * Upper bound for the GM HP stepper on one target.
 *
 * @param {object | null | undefined} target
 * @param {number} [defaultHp]
 * @returns {number}
 */
export function bannerTargetHpLossMax(target, defaultHp = 0) {
  if (target?.type === 'companion' || target?.elementType === 'companion') {
    return Math.max(1, Number(defaultHp) || 0);
  }
  const current = Number(target?.currentHp ?? target?.maxHp ?? 0);
  const def = Number(defaultHp) || 0;
  return Math.max(def, Number.isFinite(current) ? current : 0, 3);
}

/**
 * @param {number} current
 * @param {number} delta
 * @param {number} [max]
 * @returns {number}
 */
export function adjustBannerTargetHpLoss(current, delta, max = 3) {
  const n = Number(current) || 0;
  const d = Number(delta) || 0;
  const cap = Number.isFinite(Number(max)) ? Number(max) : 3;
  return Math.max(0, Math.min(cap, n + d));
}

/**
 * Resolved HP the GM has chosen for a target (override or default).
 *
 * @param {Record<string, number> | null | undefined} overrides
 * @param {string | null | undefined} instanceId
 * @param {number} defaultHp
 * @returns {number}
 */
export function resolveBannerTargetHpLoss(overrides, instanceId, defaultHp) {
  if (instanceId != null && overrides && Object.prototype.hasOwnProperty.call(overrides, instanceId)) {
    const n = Number(overrides[instanceId]);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return Math.max(0, Number(defaultHp) || 0);
}
