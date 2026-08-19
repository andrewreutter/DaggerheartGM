/**
 * Multi-player character assignment helpers.
 *
 * `assignedPlayerEmails: string[]` is the source of truth (normalized lowercase).
 * The legacy scalar `assignedPlayerEmail` is kept in sync as the first assignee so that
 * existing code, server routes, and tests that read the scalar continue to work unchanged.
 * `assignedPlayerUid` and `playerName` are also kept in sync when roster data is available.
 */

/**
 * Return the canonical list of assigned player emails for a character element.
 * Falls back to wrapping the legacy scalar so callers never have to branch.
 *
 * @param {object} el
 * @returns {string[]} Normalized lowercase emails.
 */
export function getAssignedPlayerEmails(el) {
  if (!el || typeof el !== 'object') return [];
  if (Array.isArray(el.assignedPlayerEmails) && el.assignedPlayerEmails.length > 0) {
    return el.assignedPlayerEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof el.assignedPlayerEmail === 'string' && el.assignedPlayerEmail.trim()) {
    return [el.assignedPlayerEmail.trim().toLowerCase()];
  }
  return [];
}

/**
 * Return true when the player identified by `email` and/or `uid` is assigned to the character.
 * GM callers pass `{ email: undefined, uid: undefined }` — always call with a real viewer.
 *
 * @param {object} el
 * @param {{ email?: string | null, uid?: string | null }} viewer
 * @returns {boolean}
 */
export function isCharacterAssignedToPlayer(el, { email, uid } = {}) {
  if (!el || typeof el !== 'object') return false;
  const normedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normedUid = typeof uid === 'string' ? uid.trim() : '';

  const assignedEmails = getAssignedPlayerEmails(el);

  // Email-first: email in the list OR legacy scalar match
  if (normedEmail) {
    if (assignedEmails.includes(normedEmail)) return true;
    // Legacy scalar fallback (no array yet)
    if (
      !Array.isArray(el.assignedPlayerEmails) &&
      typeof el.assignedPlayerEmail === 'string' &&
      el.assignedPlayerEmail.trim().toLowerCase() === normedEmail
    ) {
      return true;
    }
  }

  // UID fallback: uid matches the stored scalar uid AND that player is still in the list
  if (normedUid) {
    const storedUid = typeof el.assignedPlayerUid === 'string' ? el.assignedPlayerUid.trim() : '';
    if (storedUid && storedUid === normedUid) {
      // uid is only trusted if there is an assigned email (the uid tracks the first assignee)
      if (assignedEmails.length > 0 || typeof el.assignedPlayerEmail === 'string') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Build a patch object that toggles `email` in the assigned list and keeps
 * the legacy scalar in sync.
 *
 * Passing `roster` (from `buildJoinedPlayerRoster`) lets us stamp `assignedPlayerUid`
 * and `playerName` on the first assignee when they are connected.
 *
 * @param {object} el
 * @param {string} email
 * @param {{ email: string, uid?: string, name?: string }[]} [roster]
 * @returns {object} Patch object suitable for `updateActiveElement`.
 */
export function toggleAssignedPlayerEmail(el, email, roster = []) {
  const normed = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normed) return {};

  const current = getAssignedPlayerEmails(el);
  const isAssigned = current.includes(normed);
  const next = isAssigned
    ? current.filter((e) => e !== normed)
    : [...current, normed];

  return buildAssignmentPatch(next, roster);
}

/**
 * Remove a specific email from the assigned list and keep the legacy scalar in sync.
 * Used when a player is kicked from the table.
 *
 * @param {object} el
 * @param {string} email
 * @param {{ email: string, uid?: string, name?: string }[]} [roster]
 * @returns {object} Patch object.
 */
export function clearAssignedPlayerEmail(el, email, roster = []) {
  const normed = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normed) return {};
  const current = getAssignedPlayerEmails(el);
  const next = current.filter((e) => e !== normed);
  return buildAssignmentPatch(next, roster);
}

/**
 * Build a label for the character card header showing assigned player names.
 * Returns the first assignee's display name, or "Name +N" when there are multiple.
 *
 * @param {object} el
 * @param {{ email: string, name: string }[]} [roster]
 * @returns {string | null}
 */
export function assignedPlayerLabel(el, roster = []) {
  const emails = getAssignedPlayerEmails(el);
  if (emails.length === 0) return null;

  const rosterByEmail = new Map(roster.map((r) => [r.email.toLowerCase(), r]));
  const names = emails.map((e) => rosterByEmail.get(e)?.name || e);

  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

/**
 * Given the desired final list of assigned emails, build the full patch object including
 * legacy scalar sync, uid, and playerName.
 *
 * @param {string[]} emails - Already normalized lowercase emails.
 * @param {{ email: string, uid?: string, name?: string }[]} roster
 * @returns {object}
 */
function buildAssignmentPatch(emails, roster) {
  const patch = {
    assignedPlayerEmails: emails.length > 0 ? emails : [],
  };

  if (emails.length === 0) {
    // Clear everything
    patch.assignedPlayerEmail = undefined;
    patch.assignedPlayerUid = undefined;
    patch.playerName = undefined;
  } else {
    const firstEmail = emails[0];
    patch.assignedPlayerEmail = firstEmail;

    // Stamp uid/name from roster if the first assignee is connected
    const rosterEntry = roster.find((r) => r.email.toLowerCase() === firstEmail);
    if (rosterEntry) {
      if (rosterEntry.uid) patch.assignedPlayerUid = rosterEntry.uid;
      if (rosterEntry.name) patch.playerName = rosterEntry.name;
    }
  }

  return patch;
}
