/**
 * Home-lobby change detection and notification helpers.
 *
 * Determines when a table op should trigger a lobby snapshot push and
 * which subscription keys need to be notified.
 *
 * Membership ops (`add-player-email`, `remove-player-email`, `set-player-emails`)
 * always trigger; other ops only trigger when the card-visible fields change.
 */

import { summarizeTableCharacterRoster } from '../client/lib/table-character-roster.js';

const MEMBERSHIP_OPS = new Set([
  'add-player-email',
  'remove-player-email',
  'set-player-emails',
]);

/**
 * Cheap stable string representing the fields visible on a homepage card.
 * Excludes token positions, camera settings, dice rolls, etc. so those
 * ops do not fan out to home-lobby subscribers.
 *
 * @param {object|null|undefined} data — table_state data
 * @returns {string}
 */
export function tableCardLobbySignature(data) {
  const d = data || {};
  const name = typeof d.tableName === 'string' ? d.tableName.trim() : '';
  const gmName = typeof d.gmDisplayName === 'string' ? d.gmDisplayName.trim() : '';
  const roster = summarizeTableCharacterRoster(d);
  const previewUrl = typeof d.tablePreviewUrl === 'string' ? d.tablePreviewUrl.trim() : '';
  const previewAt = d.tablePreviewAt != null ? String(d.tablePreviewAt) : '';
  return `${name}|${gmName}|${roster.count}|${roster.names.join(',')}|${previewUrl}|${previewAt}`;
}

/**
 * Returns true if this table write should trigger a home-lobby snapshot push.
 *
 * @param {{ op?: object, prevData?: object, nextData?: object, prevPublic?: boolean, nextPublic?: boolean }} args
 */
export function shouldNotifyHomeLobby({ op, prevData, nextData, prevPublic, nextPublic } = {}) {
  if (op && MEMBERSHIP_OPS.has(op?.op)) return true;
  if (prevPublic !== nextPublic) return true;
  const prevSig = tableCardLobbySignature(prevData);
  const nextSig = tableCardLobbySignature(nextData);
  return prevSig !== nextSig;
}

/**
 * Fire `subscriptionManager.notifyChange` for all affected home-lobby channels.
 * Called after a table write that passes `shouldNotifyHomeLobby`.
 *
 * @param {import('../subscriptions.js').default} subscriptionManager
 * @param {{ ownerUid: string, playerEmails?: string[], notifyPublic?: boolean }} args
 */
export function notifyHomeLobby(subscriptionManager, { ownerUid, playerEmails = [], notifyPublic = false }) {
  if (ownerUid) {
    subscriptionManager.notifyChange('home_owned', ownerUid);
  }
  for (const email of playerEmails) {
    const key = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (key) subscriptionManager.notifyChange('home_invited', key);
  }
  if (notifyPublic) {
    subscriptionManager.notifyChange('home_public', 'all');
  }
}
