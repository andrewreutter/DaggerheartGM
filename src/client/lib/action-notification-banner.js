/**
 * Whether GM Ack on an action banner would apply table mutations (Cancel is meaningful).
 * Mirrors ActionBanner in DiceRoller.jsx — keep in sync when changing banner semantics.
 *
 * @param {object} roll — pending banner roll data
 * @param {{ actionAdversaryTargets?: Array<{ instanceId?: string }> }} [context]
 * @returns {boolean}
 */
export function computeActionAckTouchesTableState(roll, context = {}) {
  const { actionAdversaryTargets = [] } = context;
  const lifeSupportTargets = roll._lifeSupportTargets;
  const isLifeSupport = lifeSupportTargets != null;
  const needsLifeSupportSelection = isLifeSupport && (lifeSupportTargets?.length ?? 0) > 0;

  const isActionAdversary = !!roll._action && roll._targetType === 'adversary';
  const needsActionAdversarySelection = isActionAdversary && actionAdversaryTargets.length > 0;

  return !!(
    roll._manualTrackEdit ||
    roll._featureUse ||
    roll._cardToggle ||
    roll._reactionCall === true ||
    (roll._v2DeferUntilBannerAck === true && typeof roll._v2DeferToggleNext === 'boolean') ||
    roll._wingsOfLightFlightDefer === true ||
    !!roll._prayerDieGainHope ||
    (Array.isArray(roll._rousingSpeechTargets) && roll._rousingSpeechTargets.length > 0) ||
    needsLifeSupportSelection ||
    needsActionAdversarySelection ||
    ((roll.tags || []).length > 0 && roll._attackerInstanceId)
  );
}

/**
 * @param {object} roll
 * @param {{ actionAdversaryTargets?: Array<{ instanceId?: string }> }} [context]
 * @returns {boolean}
 */
export function shouldSuppressActionBanner(roll, context) {
  /** Pending banner required; ack applies set-table-top + session clears — not "informational" suppression. */
  if (roll?._sessionStart) return false;
  return !!(roll && roll._action && !computeActionAckTouchesTableState(roll, context));
}

/**
 * @param {object} notification — outbound action notification body
 * @param {{ actionAdversaryTargets?: Array<{ instanceId?: string }> }} [context]
 * @returns {object}
 */
export function withActionBannerSuppression(notification, context) {
  if (!notification || typeof notification !== 'object') return notification;
  if (!notification._action) return notification;
  if (!shouldSuppressActionBanner(notification, context)) return notification;
  return { ...notification, _suppressActionBanner: true };
}
