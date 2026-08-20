/**
 * Shared pre-roll intent session helpers (serialize, merge, viewer, CAS, echo skip).
 * Used by the Game Table client and by `server.js` pendingIntents routes.
 */

import { normalizeViewerEmail, ROLL_VISIBILITY_TABLE } from './roll-visibility.js';

export const PRE_ROLL_SELECTION_KEYS = [
  'selectedChips',
  'experienceIndex',
  'companionExperienceIndex',
  'advantages',
  'disadvantages',
  'targetInstanceId',
  '_rollVisibility',
];

export const PRE_ROLL_PATCH_DEBOUNCE_MS = 100;

/**
 * Align a selectedChips snapshot to the current chip list length (pad false / truncate).
 * @param {unknown} selected
 * @param {number} chipCount
 * @returns {boolean[]}
 */
export function alignSelectedChips(selected, chipCount) {
  const n = Math.max(0, Number(chipCount) || 0);
  const src = Array.isArray(selected) ? selected : [];
  return Array.from({ length: n }, (_, i) => !!src[i]);
}

/**
 * Display-only chip rows for the intent payload (no functions).
 * @param {object[]} chips
 * @returns {object[]}
 */
export function serializeDisplayChips(chips) {
  return (Array.isArray(chips) ? chips : [])
    .filter((c) => !c?._difficultyChip)
    .map((c) => ({
      label: c.label || c.name || c._featureName || '',
      description: typeof c.description === 'string' ? c.description : '',
      hopeCost: c.hopeCost || 0,
      stressCost: c.stressCost || 0,
      frequency: c.frequency || c.resetsOn || null,
      isToggle: !!c.isToggle,
      v2Intent: !!c._v2IntentChip,
    }));
}

/**
 * Build the POST /intent body from a local pre-roll session.
 * @param {object} args
 */
export function serializePreRollIntent({
  intentId,
  characterName,
  characterInstanceId,
  pending,
  chips,
  selectedChips,
  experienceIndex = null,
  companionExperienceIndex = null,
  advantages = [],
  disadvantages = [],
  targetInstanceId = null,
  _rollVisibility = ROLL_VISIBILITY_TABLE,
  needsDifficulty = false,
  difficulty = null,
  difficultyFinalized = false,
  openedByRole = 'player',
  clientWriteSeq = 0,
} = {}) {
  const rollText = pending?.rollText ?? '';
  const displayName = pending?.displayName ?? '';
  const meta = pending?.meta && typeof pending.meta === 'object' ? pending.meta : {};
  return {
    intentId,
    characterName: characterName || '',
    characterInstanceId: characterInstanceId || '',
    rollText,
    chips: serializeDisplayChips(chips),
    pending: { rollText, displayName, meta },
    selectedChips: Array.isArray(selectedChips) ? selectedChips : [],
    experienceIndex: experienceIndex ?? null,
    companionExperienceIndex: companionExperienceIndex ?? null,
    advantages: Array.isArray(advantages) ? advantages : [],
    disadvantages: Array.isArray(disadvantages) ? disadvantages : [],
    targetInstanceId: targetInstanceId ?? null,
    _rollVisibility,
    needsDifficulty: !!needsDifficulty,
    difficulty: difficulty ?? null,
    difficultyFinalized: !!difficultyFinalized,
    openedByRole: openedByRole === 'gm' ? 'gm' : 'player',
    clientWriteSeq: Number.isFinite(Number(clientWriteSeq)) ? Number(clientWriteSeq) : 0,
  };
}

function clampDifficulty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(5, Math.min(30, n));
}

/**
 * Merge a PATCH into the in-memory intent. Players cannot overwrite DC / Finalize.
 * @param {object | null | undefined} existing
 * @param {object} patch
 * @param {{ isGm?: boolean }} [opts]
 * @returns {object | null}
 */
export function mergeIntentPatch(existing, patch, { isGm = false } = {}) {
  if (!existing || typeof existing !== 'object') return existing ?? null;
  const src = patch && typeof patch === 'object' ? patch : {};
  const next = { ...existing };
  for (const key of PRE_ROLL_SELECTION_KEYS) {
    if (key in src) next[key] = src[key];
  }
  if (isGm && 'difficulty' in src) {
    const clamped = clampDifficulty(src.difficulty);
    if (clamped != null) next.difficulty = clamped;
  }
  if ('clientWriteSeq' in src) {
    const seq = Number(src.clientWriteSeq);
    if (Number.isFinite(seq)) next.clientWriteSeq = seq;
  }
  next.timestamp = Date.now();
  return next;
}

/**
 * Compare-and-swap for DELETE /intent. Missing or mismatched intentId → 409.
 * @param {object | null | undefined} existing
 * @param {unknown} intentId
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function resolveDeleteIntentCas(existing, intentId) {
  if (intentId == null || intentId === '') {
    return { ok: false, status: 400, error: 'intentId required' };
  }
  if (!existing || existing.intentId !== intentId) {
    return { ok: false, status: 409, error: 'Intent no longer pending' };
  }
  return { ok: true };
}

function viewerMatchesIdentity(viewer, uid, email) {
  const vUid = viewer?.uid != null && viewer.uid !== '' ? String(viewer.uid) : '';
  const vEmail = normalizeViewerEmail(viewer?.email);
  if (vUid && uid && vUid === String(uid)) return true;
  if (vEmail && email && vEmail === normalizeViewerEmail(email)) return true;
  return false;
}

function viewerIsInitiator(intent, viewer) {
  return viewerMatchesIdentity(viewer, intent?._initiatorUid, intent?._initiatorEmail);
}

function viewerIsAssignedPlayer(intent, viewer) {
  const vUid = viewer?.uid != null && viewer.uid !== '' ? String(viewer.uid) : '';
  const vEmail = normalizeViewerEmail(viewer?.email);
  const emails = [
    ...(Array.isArray(intent?._assignedPlayerEmails) ? intent._assignedPlayerEmails : []),
    intent?._assignedPlayerEmail,
  ];
  const uids = [
    ...(Array.isArray(intent?._assignedPlayerUids) ? intent._assignedPlayerUids : []),
    intent?._assignedPlayerUid,
  ];
  if (vEmail && emails.some((e) => e && normalizeViewerEmail(e) === vEmail)) return true;
  if (vUid && uids.some((u) => u != null && String(u) === vUid)) return true;
  return false;
}

/**
 * Who may render the shared pre-roll strip: GM + initiator + assigned player(s).
 * `intent == null` is a clear — deliver to everyone so a prior card goes away.
 * Roll privacy (`_rollVisibility`) is not used here.
 * @param {object | null | undefined} intent
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 */
export function shouldShowPreRollBanner(intent, viewer = {}) {
  if (intent == null) return true;
  if (viewer.role === 'gm') return true;
  if (viewerIsInitiator(intent, viewer)) return true;
  if (viewerIsAssignedPlayer(intent, viewer)) return true;
  return false;
}

/**
 * Skip applying an SSE echo of our own PATCH/POST (`clientWriteSeq` match).
 * @param {object | null | undefined} remote
 * @param {{ lastSentClientWriteSeq?: number | null }} [opts]
 * @returns {{ apply: boolean, reason?: string }}
 */
export function shouldApplyRemoteIntentSnapshot(remote, { lastSentClientWriteSeq = null } = {}) {
  if (!remote) return { apply: false, reason: 'null' };
  if (
    lastSentClientWriteSeq != null
    && Number(remote.clientWriteSeq) === Number(lastSentClientWriteSeq)
  ) {
    return { apply: false, reason: 'own-echo' };
  }
  return { apply: true };
}

/**
 * Selection + DC fields to bind onto local React state from a remote intent.
 * @param {object | null | undefined} intent
 */
export function applyRemoteSelectionSnapshot(intent) {
  const difficulty = clampDifficulty(intent?.difficulty);
  return {
    selectedChips: Array.isArray(intent?.selectedChips) ? intent.selectedChips : [],
    experienceIndex: intent?.experienceIndex ?? null,
    companionExperienceIndex: intent?.companionExperienceIndex ?? null,
    advantages: Array.isArray(intent?.advantages) ? intent.advantages : [],
    disadvantages: Array.isArray(intent?.disadvantages) ? intent.disadvantages : [],
    targetInstanceId: intent?.targetInstanceId ?? null,
    _rollVisibility: intent?._rollVisibility || ROLL_VISIBILITY_TABLE,
    difficulty,
    difficultyFinalized: intent?.difficultyFinalized === true,
  };
}

/**
 * Apply a remote DC draft only when it actually changed.
 * Unchanged echoes (player selection PATCH still carrying the old draft) must not
 * clobber a local GM slider value that has not been PATCHed yet.
 * @param {unknown} remoteDifficulty
 * @param {number | null | undefined} lastAppliedRemoteDifficulty
 * @returns {number | null} next draft to bind, or null to keep the local value
 */
export function remoteDifficultyDraftToApply(remoteDifficulty, lastAppliedRemoteDifficulty) {
  const next = clampDifficulty(remoteDifficulty);
  if (next == null) return null;
  if (lastAppliedRemoteDifficulty == null) return next;
  if (next !== lastAppliedRemoteDifficulty) return next;
  return null;
}
