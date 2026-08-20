/**
 * Shared pre-roll intent session helpers (serialize, merge, viewer, CAS, echo skip).
 * Used by the Game Table client and by `server.js` pendingIntents routes.
 */

import { canViewerSeeIntent, normalizeViewerEmail, ROLL_VISIBILITY_TABLE } from './roll-visibility.js';

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

/** Pool-name inputs (advantage / disadvantage) stay local this long before PATCH, like countdown names. */
export const PRE_ROLL_POOL_TEXT_DEBOUNCE_MS = 400;

/**
 * Next displayed pool-name draft. While the field is dirty (user typing), ignore
 * the parent/SSE value so echoes cannot revert in-progress text — same idea as
 * ConditionsEditor local `draft`.
 * @param {unknown} remoteName
 * @param {string} localDraft
 * @param {{ dirty?: boolean }} [opts]
 * @returns {string}
 */
export function nextPoolNameDraft(remoteName, localDraft, { dirty = false } = {}) {
  if (dirty) return typeof localDraft === 'string' ? localDraft : '';
  return typeof remoteName === 'string' ? remoteName : '';
}

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
      _advantageTriggerChip: !!c._advantageTriggerChip,
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
    helps: [],
    _groupRoll: false,
    groupMembers: [],
    _tagTeam: false,
    tagTeamPartner: null,
    tagTeamPartnerInstanceId: null,
  };
}

function clampDifficulty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(5, Math.min(30, n));
}

/**
 * GM Finalize / Unlock for POST /intent/difficulty.
 * `finalized` defaults to true (lock). Pass false to unlock and keep editing.
 */
export function applyIntentDifficultyLock(existing, { difficulty, finalized = true } = {}) {
  if (!existing || typeof existing !== 'object') return existing ?? null;
  const clamped = clampDifficulty(difficulty) ?? clampDifficulty(existing.difficulty) ?? 15;
  return {
    ...existing,
    difficulty: clamped,
    difficultyFinalized: finalized === true,
  };
}

/**
 * Merge a PATCH into the in-memory intent. Players cannot overwrite DC / Approve.
 * GM DC writes do not touch `difficultyFinalized` (Approve stays on after a live DC edit).
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
  if (existing._groupRoll || existing._tagTeam) {
    delete next._rollVisibility;
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
 * Who may render the shared pre-roll strip. Same `_rollVisibility` as the looming roll
 * (table includes audience). `intent == null` is a clear — deliver to everyone so a
 * prior card goes away.
 * @param {object | null | undefined} intent
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 */
export function shouldShowPreRollBanner(intent, viewer = {}) {
  return canViewerSeeIntent(intent, viewer);
}

/**
 * Who may toggle chips, edit pools, Proceed / Cancel, or PATCH / DELETE the session.
 * Other invited players see a read-only card.
 * @param {object | null | undefined} intent
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 */
export function isPreRollBannerInteractive(intent, viewer = {}) {
  if (intent == null) return false;
  if (viewer?.role === 'gm') return true;
  if (viewerIsInitiator(intent, viewer)) return true;
  if (viewerIsAssignedPlayer(intent, viewer)) return true;
  return false;
}

/**
 * Trimmed non-empty advantage / disadvantage names.
 * @param {unknown} names
 * @returns {string[]}
 */
export function namedPoolEntries(names) {
  return (Array.isArray(names) ? names : [])
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter(Boolean);
}

/**
 * Observer (other-player) view: only selections that are on. Empty sections stay hidden.
 * @param {object} [args]
 */
export function preRollObserverVisibleModel({
  chips = [],
  selectedChips = [],
  experienceIndex = null,
  companionExperienceIndex = null,
  advantages = [],
  disadvantages = [],
  targetInstanceId = null,
  deferExperience = false,
} = {}) {
  const featureChipIndices = [];
  const advantageTriggerIndices = [];
  (Array.isArray(chips) ? chips : []).forEach((chip, i) => {
    if (!selectedChips?.[i] || chip?._difficultyChip) return;
    if (chip._advantageTriggerChip) advantageTriggerIndices.push(i);
    else featureChipIndices.push(i);
  });
  const namedAdvantages = namedPoolEntries(advantages);
  const namedDisadvantages = namedPoolEntries(disadvantages);
  const hasExperienceIndex = experienceIndex != null || companionExperienceIndex != null;
  return {
    featureChipIndices,
    advantageTriggerIndices,
    namedAdvantages,
    namedDisadvantages,
    showExperience: !!deferExperience && hasExperienceIndex,
    showTarget: targetInstanceId != null && targetInstanceId !== '',
    showFeatureChips: featureChipIndices.length > 0,
    showAdvantageSection:
      advantageTriggerIndices.length > 0
      || namedAdvantages.length > 0
      || namedDisadvantages.length > 0,
  };
}

/**
 * Skip applying an SSE echo of our own PATCH/POST (`clientWriteSeq` match).
 * @param {object | null | undefined} remote
 * @param {{ lastSentClientWriteSeq?: number | null }} [opts]
 * @returns {{ apply: boolean, reason?: string }}
 */
export function shouldApplyRemoteIntentSnapshot(remote, { lastSentClientWriteSeq = null } = {}) {
  if (!remote) return { apply: false, reason: 'null' };
  if (lastSentClientWriteSeq == null) return { apply: true };
  const remoteSeq = Number(remote.clientWriteSeq);
  const lastSent = Number(lastSentClientWriteSeq);
  if (!Number.isFinite(remoteSeq) || !Number.isFinite(lastSent)) return { apply: true };
  if (remoteSeq === lastSent) {
    return { apply: false, reason: 'own-echo' };
  }
  if (remoteSeq < lastSent) {
    return { apply: false, reason: 'stale' };
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
