import { getAuth } from 'firebase-admin/auth';
import { getUserPreferences } from '../db.js';
import { normalizeInviteEmailList } from './table-invite-access.js';

/**
 * Throws Error with statusCode 400 if any newly added pending email has blocked this GM.
 * @param {string} appId
 * @param {string} gmUid
 * @param {string[]} previousPending
 * @param {string[]} nextPending
 */
export async function assertNewPendingInvitesNotBlockedByInvitee(appId, gmUid, previousPending, nextPending) {
  const prev = new Set(normalizeInviteEmailList(previousPending));
  const next = normalizeInviteEmailList(nextPending);
  const added = next.filter((e) => !prev.has(e));
  for (const email of added) {
    try {
      const userRecord = await getAuth().getUserByEmail(email);
      const prefs = await getUserPreferences(appId, userRecord.uid);
      const blocked = prefs.blockedGmUids || [];
      if (blocked.includes(gmUid)) {
        const err = new Error(`That player has blocked invitations from you (${email})`);
        err.statusCode = 400;
        throw err;
      }
    } catch (e) {
      if (e?.statusCode === 400) throw e;
      // user-not-found / invalid-email — allow invite to unregistered address
    }
  }
}
