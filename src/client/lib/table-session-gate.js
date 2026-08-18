/**
 * Prep mode (`top.sessionStarted === false`) and idle pause (`top.sessionPaused === true`)
 * block play-affecting ops. Legacy rows without `top` treat session as started and unpaused.
 */

const HOUR_MS = 60 * 60 * 1000;
export { HOUR_MS as SESSION_IDLE_MS };

/** @param {object} [tableStateLike] — `table_state.data` or full row data */
export function isTablePlayAllowed(tableStateLike) {
  if (!tableStateLike || typeof tableStateLike !== 'object') return true;
  const top = tableStateLike.top;
  if (!top || typeof top !== 'object') return true;
  if (top.sessionStarted === false) return false;
  if (top.sessionPaused === true) return false;
  return true;
}

/** @deprecated Use `isTablePlayAllowed` — name kept for server imports */
export function isTableSessionActive(tableStateLike) {
  return isTablePlayAllowed(tableStateLike);
}

/**
 * Allowed `update-element` / `update-elements` keys while play is blocked (prep or idle pause).
 * Keys that affect gameplay resource state (HP, stress, conditions, token positions, etc.) require
 * an active session. Setup-only fields (party scale tags, character assignment) are always allowed.
 */
export const PREP_MODE_ALLOWED_ELEMENT_UPDATE_KEYS = new Set([
  // Party-scale tag — edit during prep when building the encounter
  'minPartySize',
  // Character assignment to a player — prep-safe roster bookkeeping
  'assignedPlayerEmail',
  // Hide/reveal adversaries while staging an encounter (default visible)
  'visibleToPlayers',
]);

/**
 * Element types that are scene-dressing or setup-only, not gameplay tokens.
 * `add-elements` / `remove-element` are already prep-safe for every element type (see the
 * `gateTableOpForPrepMode` switch), so updating one of these via `update-element` is exempted
 * from the token-move gate too.
 *
 * - `mapImage` / `drawShape` — battle-map art; dragging/resizing is scene setup.
 * - `note` — notes (name, body, visibility, imageUrl) are always editable in prep.
 */
export const PREP_MODE_EXEMPT_ELEMENT_TYPES = new Set(['mapImage', 'drawShape', 'note']);

/** True if updates contain any key not allowed while play is blocked (e.g. token moves, HP, etc.). */
export function isPrepModeElementUpdateBlocked(updates, elementType) {
  if (PREP_MODE_EXEMPT_ELEMENT_TYPES.has(elementType)) return false;
  if (!updates || typeof updates !== 'object') return false;
  for (const k of Object.keys(updates)) {
    if (!PREP_MODE_ALLOWED_ELEMENT_UPDATE_KEYS.has(k)) return true;
  }
  return false;
}

/**
 * Game Table character sheet (`CharacterHoverCard`): HP/stress/armor/hope tracks need `updateFn`
 * whenever the viewer may edit this character (GM or assigned player). Rolls, target pickers, and
 * manual-track queue flows require an active session (`sessionPlayAllowed`). Gating both on
 * `sessionPlayAllowed` clears `updateFn` during prep/pause so CheckboxTracks render with no
 * `onSetFilled` and the whole sheet looks broken (no prep/pause dialog either).
 *
 * @returns {{ sheetOwner: boolean, allowPlayMechanics: boolean }}
 */
export function characterSheetTableInteractionFlags(sessionPlayAllowed, isPlayer, isMyCharacter) {
  const sheetOwner = !isPlayer || isMyCharacter;
  const allowPlayMechanics = sessionPlayAllowed && sheetOwner;
  return { sheetOwner, allowPlayMechanics };
}

/**
 * Game Table: only the GM may manually mark Hope / Stress / Armor / HP on PCs, or HP / Stress on adversaries,
 * via resource {@link CheckboxTrack} slots. Assigned players keep rolls, features, and conditions; not manual track boxes.
 */
export function gmResourceTrackCheckboxEditsAllowed(isPlayer) {
  return !isPlayer;
}

/**
 * `DiceRoller` persistent portaled banner when play is blocked (prep or idle pause).
 * Matches {@link isTablePlayAllowed} for `table_state.top` shapes that use the same flags as `app.jsx`.
 */
export function showSessionBlockedDiceBanner(sessionStarted, sessionPaused) {
  return sessionStarted === false || sessionPaused === true;
}

/**
 * When prep mode is active, reject ops that change play state. Allowed: setup + Fear pool + toggling session flags.
 * @param {object} state — table_state.data-like
 * @param {object} op — table op
 * @returns {{ ok: true, op: object } | { ok: false, error: string }}
 */
export function gateTableOpForPrepMode(state, op) {
  if (isTablePlayAllowed(state)) {
    if (op?.bypassPrepGate === true) {
      const { bypassPrepGate, ...rest } = op;
      return { ok: true, op: rest };
    }
    return { ok: true, op };
  }
  if (!op || typeof op !== 'object' || !op.op) return { ok: false, error: 'Invalid op' };
  /** GM-only: allow one blocked op without starting/resuming session (stripped before apply). */
  if (op.bypassPrepGate === true) {
    const { bypassPrepGate, ...rest } = op;
    return { ok: true, op: rest };
  }
  switch (op.op) {
    case 'set-table-top':
      return { ok: true, op };
    case 'set-fear':
      return { ok: true, op };
    case 'set-spotlight':
      return { ok: true, op };
    case 'set-countdown':
    case 'session-countdown-upsert':
    case 'session-countdown-remove':
    case 'session-countdown-patch':
    case 'session-countdown-batch':
      return { ok: true, op };
    case 'add-elements':
    case 'remove-element':
    /** Library scene → table: same as add-map + add-elements; prep/pause-safe setup. */
    case 'add-scene-snapshot':
    case 'replace-scene-snapshot':
    /** Sync saved library row onto a table element (adversary/environment base data). Prep-safe — not play mechanics. */
    case 'update-base-data':
    case 'set-map':
    case 'set-map-view':
    case 'set-map-free-explore':
    case 'set-active-map':
    case 'set-active-view':
    case 'force-player-map-view':
    case 'add-map':
    case 'sync-library-map':
    case 'link-maps-library':
    case 'add-map-view':
    case 'remove-map':
    case 'remove-map-view':
    case 'rename-map':
    case 'rename-map-view':
    case 'set-view-broadcast':
    case 'set-view-locked':
    case 'set-map-share':
    case 'set-map-overlay':
    case 'set-map-fog':
    case 'set-map-view-overlay':
    case 'set-map-view-fog':
    case 'clear-table':
    case 'set-player-emails':
    case 'add-player-email':
    case 'remove-player-email':
    case 'set-gm-display-name':
    case 'set-table-name':
    case 'set-table-public':
    case 'set-battle-mods':
      return { ok: true, op };
    case 'update-element': {
      const elements = Array.isArray(state?.elements) ? state.elements : (Array.isArray(state?.activeElements) ? state.activeElements : []);
      const el = elements.find((e) => e.instanceId === op.instanceId);
      if (isPrepModeElementUpdateBlocked(op.updates, el?.elementType)) {
        return { ok: false, error: 'Session not started' };
      }
      return { ok: true, op };
    }
    case 'update-elements': {
      const elements = Array.isArray(state?.elements) ? state.elements : (Array.isArray(state?.activeElements) ? state.activeElements : []);
      for (const row of op.updates || []) {
        const el = elements.find((e) => e.instanceId === row.instanceId);
        if (isPrepModeElementUpdateBlocked(row.updates, el?.elementType)) {
          return { ok: false, error: 'Session not started' };
        }
      }
      return { ok: true, op };
    }
    default:
      return { ok: false, error: 'Session not started' };
  }
}
