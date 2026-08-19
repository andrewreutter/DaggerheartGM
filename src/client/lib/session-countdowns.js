/**
 * Session countdowns: SRD-aligned table-level counters + player/GM visibility redaction.
 * Pure helpers — safe to import from server (subscriptions, GET handler).
 */

import { redactHiddenAdversariesForAudience } from './adversary-player-visibility.js';
import { parseDiceExpr } from './dice-utils.js';

/** @typedef {'standard' | 'progress' | 'consequence'} SessionCountdownKind */
/** @typedef {'gm' | 'players'} SessionCountdownVisibility */
/** @typedef {'none' | 'reset' | 'increasing' | 'decreasing'} SessionCountdownLooping */

export const COUNTDOWN_LOOPING_MODES = /** @type {const} */ (['none', 'reset', 'increasing', 'decreasing']);

export const COUNTDOWN_LOOPING_LABELS = {
  none: 'None',
  reset: 'Reset',
  increasing: 'Increasing',
  decreasing: 'Decreasing',
};

/** True when `formula` is dice notation (`1d4`, `2d6+1`), not a bare integer. */
export function isCountdownStartDice(formula) {
  return parseDiceExpr(formula) != null;
}

/** @param {string | null | undefined} formula */
export function parseCountdownStartNumber(formula) {
  if (formula == null || isCountdownStartDice(formula)) return null;
  const n = parseInt(String(formula).trim(), 10);
  return Number.isFinite(n) && n >= 0 && String(n) === String(formula).trim() ? n : null;
}

/** Bracket roll text for `postRoll` (same shape as rest ` [1d4]`). */
export function buildCountdownStartRollText(formula) {
  return ` [${String(formula || '').trim()}]`;
}

/**
 * Fields copied onto a new session row from {@link parseAllCountdownValues} output.
 * Dice formulas stay pending (start/current 0) until elaborated on a live table.
 * @param {{ value?: number | null, looping?: string, startFormula?: string }} cd
 */
export function countdownFieldsFromParsedCd(cd) {
  const startFormula = cd?.startFormula != null
    ? String(cd.startFormula).trim()
    : (cd?.value != null ? String(cd.value) : '');
  const looping = COUNTDOWN_LOOPING_MODES.includes(cd?.looping) ? cd.looping : 'none';
  const dice = isCountdownStartDice(startFormula);
  const n = dice ? 0 : (cd?.value ?? parseCountdownStartNumber(startFormula) ?? 0);
  return {
    looping,
    startFormula: startFormula || undefined,
    startPending: dice,
    start: n,
    current: n,
  };
}

/**
 * After the effect triggers (`current === 0`), Loop restores start (optionally from a re-roll) then applies ±1.
 * @param {{ start: number, startFormulaTotal?: number, looping: SessionCountdownLooping }} args
 * @returns {{ start: number, current: number }}
 */
export function applyCountdownLoop({ start, startFormulaTotal, looping }) {
  const prevStart = Math.max(0, Number(start) || 0);
  const base = startFormulaTotal != null ? Math.max(0, Number(startFormulaTotal) || 0) : prevStart;
  let nextStart = base;
  if (looping === 'increasing') nextStart = base + 1;
  else if (looping === 'decreasing') nextStart = Math.max(0, base - 1);
  return { start: nextStart, current: nextStart };
}

/** Loop is a GM click after the clock hits 0 — never auto-fired by roll ticks. */
export function countdownCanLoop(row) {
  if (!row) return false;
  const looping = COUNTDOWN_LOOPING_MODES.includes(row.looping) ? row.looping : 'none';
  if (looping === 'none') return false;
  if (row.startPending) return false;
  if ((row.current ?? 0) !== 0) return false;
  if (looping === 'decreasing' && (row.start ?? 0) === 0) return false;
  return true;
}

/** Pending dice clocks show the formula (`1d4`) instead of `0 / 0`. */
export function formatSessionCountdownValueLine(row) {
  if (row?.startPending && row.startFormula) return String(row.startFormula);
  return `${row?.current ?? 0} / ${row?.start ?? 0}`;
}

/**
 * Editor shows a separate numeric start only when it is not the typed formula:
 * dice after a roll, or a vanilla number that increasing/decreasing has moved.
 */
export function countdownShowsElaboratedStart({ startFormula, start, startPending }) {
  const formula = String(startFormula || '').trim();
  if (isCountdownStartDice(formula)) return !startPending;
  const n = parseCountdownStartNumber(formula);
  if (n == null) return false;
  return Math.max(0, Number(start) || 0) !== n;
}

/** @param {string} cardKey @param {string} featureKey @param {number} cdIdx */
export function buildLegacyFeatureCountdownKey(cardKey, featureKey, cdIdx) {
  return `${cardKey}|${featureKey}|${cdIdx}`;
}

/** @param {string} label e.g. "Progress Countdown" from parseAllCountdownValues */
export function deriveKindFromCountdownLabel(label) {
  const s = String(label || '').toLowerCase();
  if (s.includes('progress')) return 'progress';
  if (s.includes('consequence')) return 'consequence';
  return 'standard';
}

/**
 * @param {string} key legacy `featureCountdowns` key
 * @returns {{ cardKey: string, featureKey: string, cdIdx: number } | null}
 */
export function parseLegacyCountdownKey(key) {
  const parts = String(key).split('|');
  if (parts.length < 3) return null;
  const cdIdx = parseInt(parts.pop(), 10);
  const featureKey = parts.pop();
  if (!Number.isFinite(cdIdx)) return null;
  const cardKey = parts.join('|');
  return { cardKey, featureKey, cdIdx };
}

/** @param {{ cardKey: string, featureKey: string, cdIdx: number, elementInstanceId?: string }} ref */
export function legacyKeyFromSourceRef(ref) {
  if (ref.elementInstanceId) {
    return `${ref.elementInstanceId}|${ref.cardKey}|${ref.featureKey}|${ref.cdIdx}`;
  }
  return buildLegacyFeatureCountdownKey(ref.cardKey, ref.featureKey, ref.cdIdx);
}

/**
 * @param {object} entry session countdown row
 * @param {string} legacyKey
 */
export function sessionCountdownMatchesLegacyKey(entry, legacyKey) {
  const ref = entry?.sourceRef;
  if (!ref) return false;
  return legacyKeyFromSourceRef(ref) === legacyKey;
}

/**
 * @param {Array<object>} sessionCountdowns
 * @param {string} cardKey
 * @param {string} featureKey
 * @param {number} cdIdx
 */
export function findSessionCountdownBySource(sessionCountdowns, cardKey, featureKey, cdIdx) {
  if (!Array.isArray(sessionCountdowns)) return undefined;
  return sessionCountdowns.find(
    (c) =>
      c?.sourceRef &&
      c.sourceRef.cardKey === cardKey &&
      c.sourceRef.featureKey === featureKey &&
      Number(c.sourceRef.cdIdx) === Number(cdIdx)
  );
}

/**
 * @param {object} state table_state-like
 * @param {'gm' | 'player'} audience
 * @returns {object} shallow clone with `sessionCountdowns` redacted for players
 */
export function redactSessionCountdownsForAudience(state, audience) {
  if (!state || typeof state !== 'object') return state;
  if (audience !== 'player') return state;
  const list = state.sessionCountdowns;
  if (!Array.isArray(list) || list.length === 0) return state;
  const filtered = list.filter((c) => c && c.visibility !== 'gm');
  if (filtered.length === list.length) return state;
  return { ...state, sessionCountdowns: filtered };
}

/**
 * Encounter panel notes: same visibility contract as session countdowns (`visibility === 'gm'` → GM only).
 * Resolved table state uses `elements` (not `activeElements`).
 *
 * @param {object} state table_state-like
 * @param {'gm' | 'player'} audience
 */
export function redactEncounterNotesForAudience(state, audience) {
  if (!state || typeof state !== 'object') return state;
  if (audience !== 'player') return state;
  const els = state.elements;
  if (!Array.isArray(els)) return state;
  const filtered = els.filter((el) => {
    if (el?.elementType !== 'note') return true;
    return el.visibility !== 'gm';
  });
  if (filtered.length === els.length) return state;
  return { ...state, elements: filtered };
}

/**
 * GM-only reusable join token. Players already on the table must not see it.
 * @param {object} state table_state-like
 * @param {'gm' | 'player'} audience
 */
export function redactInviteLinkForAudience(state, audience) {
  if (!state || typeof state !== 'object') return state;
  if (audience !== 'player') return state;
  if (!('inviteLink' in state)) return state;
  const { inviteLink: _inviteLink, ...rest } = state;
  return rest;
}

/** Apply all GM-only redactions for player SSE / GET table_state (countdowns + notes + invite link + hidden adversaries). */
export function redactTableStateForPlayerAudience(state) {
  let s = redactSessionCountdownsForAudience(state, 'player');
  s = redactEncounterNotesForAudience(s, 'player');
  s = redactInviteLinkForAudience(s, 'player');
  s = redactHiddenAdversariesForAudience(s, 'player');
  return s;
}

/** Spectator GET/SSE: player redaction plus no invite emails / assignment emails. */
export function redactTableStateForSpectatorAudience(state) {
  const s = redactTableStateForPlayerAudience(state);
  const elements = Array.isArray(s.elements)
    ? s.elements.map((el) => {
      if (!el || typeof el !== 'object') return el;
      const next = { ...el };
      delete next.assignedPlayerEmail;
      delete next.assignedPlayerUid;
      return next;
    })
    : s.elements;
  return { ...s, elements, playerEmails: [], isPublic: true };
}

/** Hope/Fear duality parse from roll subItems (matches ActionLog). */
export function parseDualityFromSubItems(subItems) {
  if (!Array.isArray(subItems)) return null;
  let hopeResult = null;
  let fearResult = null;
  let total = 0;
  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    const result = parseInt(sub.result, 10);
    if (Number.isNaN(result)) continue;
    total += result;
    if (/hope/i.test(sub.pre || '')) hopeResult = result;
    else if (/fear/i.test(sub.pre || '')) fearResult = result;
  }
  if (hopeResult === null || fearResult === null) return null;
  const dominant =
    hopeResult === fearResult ? 'critical' : hopeResult > fearResult ? 'hope' : 'fear';
  return { total, hopeResult, fearResult, dominant };
}

/**
 * @returns {'failure_fear'|'failure_hope'|'success_fear'|'success_hope'|'critical'|null}
 */
export function classifyDaggerheartRollOutcome(roll) {
  const dh = parseDualityFromSubItems(roll?.subItems);
  if (!dh) return null;
  if (dh.dominant === 'critical') return 'critical';
  const dc = roll?._difficulty;
  if (dc == null || typeof dc !== 'number' || Number.isNaN(dc)) return null;
  const success = dh.total >= dc;
  if (!success && dh.dominant === 'fear') return 'failure_fear';
  if (!success && dh.dominant === 'hope') return 'failure_hope';
  if (success && dh.dominant === 'fear') return 'success_fear';
  if (success && dh.dominant === 'hope') return 'success_hope';
  return null;
}

/** SRD Dynamic Countdown Advancement — returns ticks to subtract from current (non-negative). */
export function getDynamicAdvancementTicks(outcome) {
  switch (outcome) {
    case 'failure_fear':
      return { progress: 0, consequence: 3 };
    case 'failure_hope':
      return { progress: 0, consequence: 2 };
    case 'success_fear':
      return { progress: 1, consequence: 1 };
    case 'success_hope':
      return { progress: 2, consequence: 0 };
    case 'critical':
      return { progress: 3, consequence: 0 };
    default:
      return { progress: 0, consequence: 0 };
  }
}

/**
 * Rows for GM reference UI — tick values always match {@link getDynamicAdvancementTicks}.
 * @returns {Array<{ outcome: string, title: string, detail: string, progress: number, consequence: number }>}
 */
export function getSessionCountdownDynamicChartRows() {
  const meta = [
    {
      outcome: 'critical',
      title: 'Critical',
      detail: 'Hope die equals Fear die (no DC needed)',
    },
    {
      outcome: 'success_hope',
      title: 'Success · Hope higher',
      detail: 'Hope + Fear total ≥ DC; Hope die is higher',
    },
    {
      outcome: 'success_fear',
      title: 'Success · Fear higher',
      detail: 'Total ≥ DC; Fear die is higher',
    },
    {
      outcome: 'failure_hope',
      title: 'Failure · Hope higher',
      detail: 'Total < DC; Hope die is higher',
    },
    {
      outcome: 'failure_fear',
      title: 'Failure · Fear higher',
      detail: 'Total < DC; Fear die is higher',
    },
  ];
  return meta.map((row) => {
    const t = getDynamicAdvancementTicks(row.outcome);
    return { ...row, progress: t.progress, consequence: t.consequence };
  });
}

/**
 * @param {object} roll
 * @param {Array<{ instanceId: string, elementType?: string }>} activeElements
 */
export function rollIsPcActionRoll(roll, activeElements) {
  if (!roll || roll._action || roll._rest || roll.silent) return false;
  const id = roll._attackerInstanceId;
  if (!id || !Array.isArray(activeElements)) return false;
  const el = activeElements.find((e) => e.instanceId === id);
  return el?.elementType === 'character';
}

/**
 * @param {number} current
 * @param {number} subtract
 */
export function tickDown(current, subtract) {
  return Math.max(0, current - subtract);
}

const DEFAULT_ENTRY = {
  kind: 'standard',
  visibility: 'players',
  current: 0,
  start: 0,
  autoStandard: false,
  autoDynamic: false,
  looping: 'none',
  startPending: false,
};

function normalizeLooping(value) {
  return COUNTDOWN_LOOPING_MODES.includes(value) ? value : 'none';
}

function normalizeStartFormula(value) {
  if (value == null) return undefined;
  const s = String(value).trim().slice(0, 40);
  return s || undefined;
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeSessionCountdownEntry(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ENTRY, id: '', label: '' };
  const src = raw.sourceRef && typeof raw.sourceRef === 'object' ? { ...raw.sourceRef } : undefined;
  const flags = raw.flags && typeof raw.flags === 'object' ? { ...raw.flags } : undefined;
  const startFormula = normalizeStartFormula(raw.startFormula);
  const dice = !!(startFormula && isCountdownStartDice(startFormula));
  return {
    ...DEFAULT_ENTRY,
    ...raw,
    id: String(raw.id || ''),
    label: String(raw.label ?? '').slice(0, 200),
    kind: raw.kind === 'progress' || raw.kind === 'consequence' ? raw.kind : 'standard',
    visibility: raw.visibility === 'gm' ? 'gm' : 'players',
    current: Math.max(0, Number(raw.current) || 0),
    start: Math.max(0, Number(raw.start) || 0),
    autoStandard: !!raw.autoStandard,
    autoDynamic: !!raw.autoDynamic,
    looping: normalizeLooping(raw.looping),
    startFormula,
    startPending: dice ? !!raw.startPending : false,
    sourceRef: src,
    linkedGroupId: raw.linkedGroupId != null ? String(raw.linkedGroupId).slice(0, 120) : undefined,
    flags,
  };
}

/**
 * Compute countdown updates from one qualifying PC action roll (GM automation v2 + v3).
 * @returns {{ updates: Array<{ id: string, current: number }>, featureKeys: string[] } | null}
 */
export function computeSessionCountdownUpdatesFromRoll(sessionCountdowns, roll, activeElements) {
  if (!Array.isArray(sessionCountdowns) || sessionCountdowns.length === 0) return null;
  if (!rollIsPcActionRoll(roll, activeElements)) return null;
  const dh = parseDualityFromSubItems(roll.subItems);
  if (!dh) return null;

  const outcome = classifyDaggerheartRollOutcome(roll);
  const dynTicks = outcome != null ? getDynamicAdvancementTicks(outcome) : null;

  const updates = [];
  const featureKeys = [];

  for (const row of sessionCountdowns) {
    if (!row?.id) continue;
    let next = row.current ?? 0;
    let changed = false;

    if (row.autoStandard && row.kind === 'standard') {
      const n = tickDown(next, 1);
      if (n !== next) {
        next = n;
        changed = true;
      }
    }

    if (row.autoDynamic && dynTicks && (row.kind === 'progress' || row.kind === 'consequence')) {
      const sub = row.kind === 'progress' ? dynTicks.progress : dynTicks.consequence;
      if (sub > 0) {
        const n = tickDown(next, sub);
        if (n !== next) {
          next = n;
          changed = true;
        }
      }
    }

    if (changed) {
      updates.push({ id: row.id, current: next });
      if (row.sourceRef) featureKeys.push(legacyKeyFromSourceRef(row.sourceRef));
    }
  }

  if (updates.length === 0) return null;
  return { updates, featureKeys };
}
