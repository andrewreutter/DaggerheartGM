/**
 * Pre-roll roll visibility: who may see dice results, pending banners, and Action Log entries.
 *
 * Default / omitted is table-visible. Privacy is chosen on the pre-roll sheet and stamped
 * as `_rollVisibility` on persisted `dice_rolls.data`. Delivery is filtered server-side.
 */

export const ROLL_VISIBILITY_TABLE = 'table';
export const ROLL_VISIBILITY_GM_AND_PLAYER = 'gm_and_player';
export const ROLL_VISIBILITY_GM_ONLY = 'gm_only';

/**
 * @param {unknown} value
 * @returns {'table' | 'gm_and_player' | 'gm_only'}
 */
export function normalizeRollVisibility(value) {
  if (value === ROLL_VISIBILITY_GM_AND_PLAYER || value === ROLL_VISIBILITY_GM_ONLY) return value;
  return ROLL_VISIBILITY_TABLE;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRestrictedRollVisibility(value) {
  return value === ROLL_VISIBILITY_GM_AND_PLAYER || value === ROLL_VISIBILITY_GM_ONLY;
}

/**
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeViewerEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * @param {object | null | undefined} roll
 * @param {{ role?: 'gm' | 'player' | 'spectator', uid?: string | null, email?: string | null }} viewer
 * @returns {boolean}
 */
export function canViewerSeeRoll(roll, viewer = {}) {
  const vis = normalizeRollVisibility(roll?._rollVisibility);
  if (vis === ROLL_VISIBILITY_TABLE) return true;
  const role = viewer?.role;
  if (role === 'gm') return true;
  if (vis === ROLL_VISIBILITY_GM_ONLY) return false;
  if (role !== 'player') return false;
  return viewerMatchesIncludedPlayer(roll, viewer);
}

/**
 * @param {object | null | undefined} intent
 * @param {{ role?: 'gm' | 'player' | 'spectator', uid?: string | null, email?: string | null }} viewer
 * @returns {boolean}
 */
export function canViewerSeeIntent(intent, viewer = {}) {
  if (intent == null) return true;
  return canViewerSeeRoll(
    {
      _rollVisibility: intent._rollVisibility,
      _initiatorUid: intent._initiatorUid,
      _visibilityPlayerUid: intent._visibilityPlayerUid || intent._initiatorUid,
      _visibilityPlayerEmail: intent._visibilityPlayerEmail || intent._initiatorEmail,
    },
    viewer,
  );
}

/**
 * @param {unknown} rolls
 * @param {{ role?: 'gm' | 'player' | 'spectator', uid?: string | null, email?: string | null }} viewer
 * @returns {object[]}
 */
export function filterRollsForViewer(rolls, viewer) {
  if (!Array.isArray(rolls)) return [];
  return rolls.filter((roll) => canViewerSeeRoll(roll, viewer));
}

export const filterBannersForViewer = filterRollsForViewer;

/**
 * Cache key for per-audience banners SSE strings: `gm` | `spectator` | `player:${uid|email}`.
 * @param {{ role?: string, uid?: string | null, email?: string | null } | null | undefined} viewer
 * @returns {string}
 */
export function bannerViewerCacheKey(viewer) {
  if (!viewer || viewer.role === 'spectator' || viewer.role == null) return 'spectator';
  if (viewer.role === 'gm') return 'gm';
  const uid = viewer.uid != null && viewer.uid !== '' ? String(viewer.uid) : '';
  const email = normalizeViewerEmail(viewer.email);
  return `player:${uid || email || '?'}`;
}

/**
 * Server-side normalize of a client-requested visibility. Do not trust client-supplied
 * included-player fields: players may only include themselves; GM `gm_and_player` must
 * name the actor's assigned player (else coerced to `gm_only`).
 *
 * @param {{
 *   requestedVisibility?: unknown,
 *   isGm?: boolean,
 *   requesterUid?: string | null,
 *   requesterEmail?: string | null,
 *   assignedPlayerUid?: string | null,
 *   assignedPlayerEmail?: string | null,
 * }} opts
 * @returns {{
 *   _rollVisibility: 'table' | 'gm_and_player' | 'gm_only',
 *   _visibilityPlayerUid?: string | null,
 *   _visibilityPlayerEmail?: string | null,
 * }}
 */
export function normalizePostedRollVisibility({
  requestedVisibility,
  isGm = false,
  requesterUid = null,
  requesterEmail = null,
  assignedPlayerUid = null,
  assignedPlayerEmail = null,
  assignedPlayerEmails = [],
} = {}) {
  const requested = normalizeRollVisibility(requestedVisibility);
  if (!isGm) {
    if (requested === ROLL_VISIBILITY_TABLE) {
      return { _rollVisibility: ROLL_VISIBILITY_TABLE };
    }
    return {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: requesterUid || null,
      _visibilityPlayerEmail: requesterEmail || null,
    };
  }
  if (requested === ROLL_VISIBILITY_TABLE) {
    return { _rollVisibility: ROLL_VISIBILITY_TABLE };
  }
  if (requested === ROLL_VISIBILITY_GM_ONLY) {
    return { _rollVisibility: ROLL_VISIBILITY_GM_ONLY };
  }
  if (assignedPlayerUid || assignedPlayerEmail) {
    const result = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: assignedPlayerUid || null,
      _visibilityPlayerEmail: assignedPlayerEmail || null,
    };
    if (Array.isArray(assignedPlayerEmails) && assignedPlayerEmails.length > 1) {
      result._visibilityPlayerEmails = assignedPlayerEmails;
    }
    return result;
  }
  return { _rollVisibility: ROLL_VISIBILITY_GM_ONLY };
}

/**
 * Strip client-supplied visibility fields, then stamp the server-normalized result.
 * Table (default) leaves the fields omitted.
 *
 * @param {object} rollData
 * @param {Parameters<typeof normalizePostedRollVisibility>[0]} opts
 * @returns {object}
 */
export function stampNormalizedRollVisibility(rollData, opts = {}) {
  if (!rollData || typeof rollData !== 'object') return rollData;
  delete rollData._rollVisibility;
  delete rollData._visibilityPlayerUid;
  delete rollData._visibilityPlayerEmail;
  delete rollData._visibilityPlayerEmails;
  if (opts.requestedVisibility == null || opts.requestedVisibility === '') return rollData;
  const stamped = normalizePostedRollVisibility(opts);
  if (stamped._rollVisibility === ROLL_VISIBILITY_TABLE) return rollData;
  Object.assign(rollData, stamped);
  return rollData;
}

/**
 * @param {object | null | undefined} characterEl
 * @returns {boolean}
 */
export function characterHasAssignedPlayer(characterEl) {
  return !!(characterEl?.assignedPlayerUid || characterEl?.assignedPlayerEmail);
}

/**
 * @param {object | null | undefined} characterEl
 * @param {{ email?: string, uid?: string, name?: string }[]} [joinedPlayers]
 * @returns {string | null}
 */
export function assignedPlayerDisplayName(characterEl, joinedPlayers = []) {
  if (!characterHasAssignedPlayer(characterEl)) return null;
  const email = normalizeViewerEmail(characterEl.assignedPlayerEmail);
  const uid = characterEl.assignedPlayerUid != null ? String(characterEl.assignedPlayerUid) : '';
  const row = (joinedPlayers || []).find((p) => {
    const pEmail = normalizeViewerEmail(p?.email);
    const pUid = p?.uid != null ? String(p.uid) : '';
    return (email && pEmail === email) || (uid && pUid === uid);
  });
  if (row?.name && String(row.name).trim()) return String(row.name).trim();
  if (characterEl.playerName && String(characterEl.playerName).trim()) {
    return String(characterEl.playerName).trim();
  }
  if (characterEl.assignedPlayerEmail) return String(characterEl.assignedPlayerEmail);
  return 'player';
}

/**
 * @param {object | null | undefined} roll
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 * @returns {boolean}
 */
function viewerMatchesIncludedPlayer(roll, viewer) {
  const uid = viewer?.uid != null && viewer.uid !== '' ? String(viewer.uid) : '';
  const email = normalizeViewerEmail(viewer?.email);
  const includedUid = roll?._visibilityPlayerUid || roll?._initiatorUid || '';
  const includedEmail = normalizeViewerEmail(roll?._visibilityPlayerEmail);
  if (uid && includedUid && uid === String(includedUid)) return true;
  if (email && includedEmail && email === includedEmail) return true;
  // Multi-assignee: check _visibilityPlayerEmails / _visibilityPlayerUids arrays
  const extraEmails = Array.isArray(roll?._visibilityPlayerEmails) ? roll._visibilityPlayerEmails : [];
  if (email && extraEmails.some((e) => normalizeViewerEmail(e) === email)) return true;
  const extraUids = Array.isArray(roll?._visibilityPlayerUids) ? roll._visibilityPlayerUids : [];
  if (uid && extraUids.some((u) => u != null && String(u) === uid)) return true;
  return false;
}
