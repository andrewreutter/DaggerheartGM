/**
 * Pure helpers for table invitation access tiers (owner / accepted player / pending / none).
 */

/** @param {string} [email] */
export function normalizeInviteEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * @param {string} email
 * @param {string[]|undefined} list
 */
export function emailInInviteList(email, list) {
  const n = normalizeInviteEmail(email);
  if (!n) return false;
  return (list || []).some((e) => normalizeInviteEmail(e) === n);
}

/**
 * @param {object} opts
 * @param {string} opts.userUid
 * @param {string} [opts.userEmail]
 * @param {string} opts.gmUid
 * @param {object} [opts.tableState]
 * @param {string[]} [opts.blockedGmUids]
 * @returns {'owner'|'player'|'pending'|'none'}
 */
export function resolveInviteRole({ userUid, userEmail, gmUid, tableState, blockedGmUids }) {
  if (userUid === gmUid) return 'owner';
  const accepted = tableState?.playerEmails || [];
  const pending = tableState?.pendingPlayerEmails || [];
  if (emailInInviteList(userEmail, accepted)) return 'player';
  if (emailInInviteList(userEmail, pending)) {
    const blocked = Array.isArray(blockedGmUids) && blockedGmUids.includes(gmUid);
    if (blocked) return 'none';
    return 'pending';
  }
  return 'none';
}

/**
 * Deduplicate and normalize email list for storage (trim + lowercase).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeInviteEmailList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    if (typeof e !== 'string') continue;
    const n = normalizeInviteEmail(e);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
