/**
 * Player spotlight-request banner payload (pending `_action` until the GM acks).
 */

import { buildSpotlightRequestActionLabel } from './trait-roll-text.js';

function clonePlain(value) {
  if (value == null || typeof value !== 'object') return value ?? {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.characterName]
 * @param {string} [opts.displayName]
 * @param {string} opts.rollText
 * @param {object} [opts.rollMeta]
 * @returns {object}
 */
export function buildSpotlightRequestNotification({
  characterName,
  displayName,
  rollText,
  rollMeta = {},
} = {}) {
  const name = String(characterName || '').trim() || 'Character';
  const actionName = buildSpotlightRequestActionLabel({
    actorName: name,
    displayName,
    rollMeta,
  });
  const attackerInstanceId = rollMeta._attackerInstanceId ?? null;
  return {
    _action: true,
    _spotlightRequest: true,
    rollUser: name,
    actionName,
    actionText: `${name} is requesting the spotlight to do ${actionName}.`,
    _attackerInstanceId: attackerInstanceId,
    _spotlightRequestResume: {
      rollText,
      displayName,
      rollMeta: clonePlain(rollMeta),
    },
  };
}

/**
 * Pending `_spotlightRequest` banners for one PC (duplicate-replace).
 * @param {object[] | null | undefined} pendingBanners
 * @param {string | null | undefined} attackerInstanceId
 * @returns {object[]}
 */
export function findPendingSpotlightRequestForCharacter(pendingBanners, attackerInstanceId) {
  if (attackerInstanceId == null || attackerInstanceId === '') return [];
  if (!Array.isArray(pendingBanners) || pendingBanners.length === 0) return [];
  return pendingBanners.filter(
    (b) =>
      b?._spotlightRequest === true &&
      b._attackerInstanceId === attackerInstanceId &&
      b._rollDbId != null,
  );
}
