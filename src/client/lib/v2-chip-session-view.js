/**
 * V2 banner chips — **session vs sheet vs chip** (see below).
 *
 * `isPlayer` means **player session vs GM session** (who is logged in). It does **not** encode:
 * - Which character sheet is UI context (assigned PC vs cross-sheet Rally on another PC’s sheet).
 * - Whose feature produced a chip (`chip._ownerInstanceId`, e.g. Bard X’s Rally).
 * - Cross-sheet viewer (`chip._crossSheetViewerInstanceId` / `collectChipsForOtherCharacterSheets`).
 * - Who initiated the roll (`roll._initiatorUid`).
 *
 * **Rally (X gives Y a die):** Player Y stays `isPlayer === true`. Chip visibility and server routes key off
 * `viewerInstanceId` (Y) and chip keys, not `!isPlayer` alone. Prefer `sessionRole === 'gm'` for GM-only UI
 * (banner hints, table-op authority), not `!isPlayer` unless the file is exclusively session-level.
 */

/**
 * @param {{ tableCharacters: object[], userUid?: string|null, playerEmailOrPreview?: string }} args
 * @returns {string|null}
 */
export function getPrimaryCharacterInstanceId({ tableCharacters, userUid, playerEmailOrPreview }) {
  const email = (playerEmailOrPreview || '').toLowerCase();
  const uid = userUid;
  const list = Array.isArray(tableCharacters) ? tableCharacters : [];
  const el = list.find(
    (c) =>
      (uid && c.assignedPlayerUid === uid) ||
      (email && (c.assignedPlayerEmail || '').toLowerCase() === email)
  );
  return el?.instanceId ?? null;
}

/**
 * Single source of truth for V2 review-chip `viewer` and `viewerCharacterInstanceId` / `sessionRole`.
 *
 * @param {{
 *   isPlayer: boolean,
 *   user?: { uid?: string } | null,
 *   playerEmail?: string,
 *   previewAsPlayerEmail?: string,
 *   tableCharacters?: object[],
 * }} opts
 * @returns {{
 *   sessionRole: 'gm'|'player',
 *   assignedCharacterInstanceId: string|null,
 *   viewer: { role: 'gm' } | { role: 'player', viewerCharacterInstanceId: string|null },
 * }}
 */
export function buildV2ChipViewer(opts) {
  const { isPlayer, user, playerEmail, previewAsPlayerEmail, tableCharacters } = opts || {};
  const sessionRole = isPlayer ? 'player' : 'gm';
  const emailForLookup = previewAsPlayerEmail || playerEmail || '';
  const assignedCharacterInstanceId = isPlayer
    ? getPrimaryCharacterInstanceId({
        tableCharacters: tableCharacters || [],
        userUid: user?.uid,
        playerEmailOrPreview: emailForLookup,
      })
    : null;
  const viewer =
    sessionRole === 'gm'
      ? { role: 'gm' }
      : { role: 'player', viewerCharacterInstanceId: assignedCharacterInstanceId };
  return { sessionRole, assignedCharacterInstanceId, viewer };
}

/**
 * Muted suffix on the dice banner title when the **GM client** is viewing a roll from a **character**
 * that has an **assigned player** (GM helper mode). Not shown for unassigned PCs or adversary attackers.
 *
 * @param {{
 *   sessionRole: 'gm'|'player',
 *   roll: object,
 *   attackerElement: object|null|undefined,
 * }} args
 * @returns {string} e.g. `' · GM'` or `''`
 */
export function getGmHelperBannerSuffix({ sessionRole, roll, attackerElement }) {
  if (sessionRole !== 'gm') return '';
  if (!roll?._attackerInstanceId) return '';
  if (roll._attackerType === 'adversary') return '';
  if (!attackerElement) return '';
  const hasAssignee =
    !!attackerElement.assignedPlayerUid ||
    !!(attackerElement.assignedPlayerEmail && String(attackerElement.assignedPlayerEmail).trim());
  if (!hasAssignee) return '';
  return ' · GM';
}

/**
 * @param {{ sessionRole: 'gm'|'player', roll: object, attackerElement: object|null|undefined }} args
 * @returns {string}
 */
export function getGmHelperBannerTooltip({ sessionRole, roll, attackerElement }) {
  return getGmHelperBannerSuffix({ sessionRole, roll, attackerElement })
    ? 'GM acting for assigned player'
    : '';
}
