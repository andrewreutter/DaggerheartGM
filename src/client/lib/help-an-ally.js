/**
 * Help an Ally — core table mechanic (not a V2 feature module).
 *
 * Helper dice stay outside the actor’s own advantage/disadvantage pool.
 * Multiple helpers each spend Hope; the roll adds keep-highest of those dice.
 */

import { canViewerSeeIntent } from './roll-visibility.js';
import { getAssignedPlayerEmails, isCharacterAssignedToPlayer } from './character-assignment.js';
import { getPrimaryCharacterInstanceId } from './v2-chip-session-view.js';

const HELP_SUFFIX_RE = /\s+—\s+help:\s+.+$/;

/**
 * @param {unknown} name
 * @returns {string}
 */
export function defaultHelpLabel(name) {
  const n = String(name || '').trim() || 'Ally';
  return `${n} helps`;
}

/**
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isHelpAllyReactionMeta(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return !!(meta._isReaction || meta._reactionCall);
}

/**
 * @param {object | null | undefined} intent
 * @returns {boolean}
 */
export function isHelpAllyReactionIntent(intent) {
  return isHelpAllyReactionMeta(intent?.pending?.meta);
}

/**
 * Split a trailing Help an Ally names+dice block off roll text so own-pool extract
 * does not treat helper dice as the actor’s advantage.
 *
 * Prefers the formatted suffix for `helps` when provided; also recognizes a
 * leftover ` — help:` prefix from older rolls.
 *
 * @param {unknown} rollText
 * @param {unknown} [helps]
 * @returns {{ text: string, helpSuffix: string }}
 */
export function splitHelpAllySuffix(rollText, helps) {
  if (rollText == null) return { text: rollText, helpSuffix: '' };
  if (typeof rollText !== 'string') return { text: rollText, helpSuffix: '' };
  const formatted = formatHelpAllyRollSuffix(helps);
  if (formatted && rollText.endsWith(formatted)) {
    return {
      text: rollText.slice(0, -formatted.length).trimEnd(),
      helpSuffix: formatted,
    };
  }
  const m = rollText.match(HELP_SUFFIX_RE);
  if (!m) return { text: rollText, helpSuffix: '' };
  return {
    text: rollText.slice(0, -m[0].length).trimEnd(),
    helpSuffix: m[0],
  };
}

/**
 * @param {unknown} entry
 * @returns {object | null}
 */
function normalizeHelpEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const instanceId = String(entry.instanceId || '').trim();
  if (!instanceId) return null;
  const hopeCost = Number.isFinite(Number(entry.hopeCost)) ? Math.max(0, Number(entry.hopeCost)) : 1;
  const die = typeof entry.die === 'string' && entry.die.trim() ? entry.die.trim() : 'd6';
  const label = typeof entry.label === 'string' && entry.label.trim()
    ? entry.label.trim()
    : defaultHelpLabel('Ally');
  return {
    instanceId,
    playerUid: entry.playerUid ?? null,
    playerEmail: entry.playerEmail ?? null,
    label,
    hopeCost,
    die,
  };
}

/**
 * Upsert or remove a help row by `instanceId`.
 * Pass `{ instanceId, active: false }` or `{ instanceId, remove: true }` to remove.
 *
 * @param {unknown} helps
 * @param {object | null} entry
 * @returns {object[]}
 */
export function mergeHelpAllyEntry(helps, entry) {
  const list = Array.isArray(helps) ? helps.map((h) => normalizeHelpEntry(h)).filter(Boolean) : [];
  if (!entry || typeof entry !== 'object' || !entry.instanceId) return list;
  const instanceId = String(entry.instanceId).trim();
  if (!instanceId) return list;
  if (entry.active === false || entry.remove === true) {
    return list.filter((h) => h.instanceId !== instanceId);
  }
  const next = normalizeHelpEntry(entry);
  if (!next) return list;
  const idx = list.findIndex((h) => h.instanceId === instanceId);
  if (idx >= 0) {
    const merged = { ...list[idx], ...next };
    const copy = [...list];
    copy[idx] = merged;
    return copy;
  }
  return [...list, next];
}

/**
 * Other PCs who may Help (not the actor). GM: every other PC. Player: assigned PCs only.
 *
 * @param {{
 *   actorInstanceId?: string | null,
 *   activeElements?: object[],
 *   viewer?: { role?: string, uid?: string | null, email?: string | null },
 *   isReaction?: boolean,
 * }} args
 * @returns {object[]}
 */
export function eligibleHelpCharacters({
  actorInstanceId = null,
  activeElements = [],
  viewer = {},
  isReaction = false,
} = {}) {
  if (isReaction) return [];
  const role = viewer?.role;
  if (role === 'spectator') return [];
  const chars = (Array.isArray(activeElements) ? activeElements : []).filter((e) => (
    e
    && e.elementType === 'character'
    && e.instanceId
    && e.instanceId !== actorInstanceId
  ));
  if (role === 'gm') return chars;
  if (role !== 'player') return [];
  return chars.filter((c) => isCharacterAssignedToPlayer(c, {
    email: viewer.email,
    uid: viewer.uid,
  }));
}

/**
 * The one PC a player uses for the Help toggle (primary assigned, else first eligible).
 *
 * @param {{
 *   actorInstanceId?: string | null,
 *   activeElements?: object[],
 *   viewer?: { role?: string, uid?: string | null, email?: string | null },
 *   isReaction?: boolean,
 * }} args
 * @returns {object | null}
 */
export function pickPlayerHelpCharacter({
  actorInstanceId = null,
  activeElements = [],
  viewer = {},
  isReaction = false,
} = {}) {
  const eligible = eligibleHelpCharacters({
    actorInstanceId,
    activeElements,
    viewer,
    isReaction,
  });
  if (eligible.length === 0) return null;
  const primaryId = getPrimaryCharacterInstanceId({
    tableCharacters: (Array.isArray(activeElements) ? activeElements : [])
      .filter((e) => e?.elementType === 'character'),
    userUid: viewer?.uid,
    playerEmailOrPreview: viewer?.email,
  });
  if (primaryId && primaryId !== actorInstanceId) {
    const hit = eligible.find((c) => c.instanceId === primaryId);
    if (hit) return hit;
  }
  return eligible[0];
}

/**
 * @param {unknown} helps
 * @returns {string}
 */
export function formatHelpAllyRollSuffix(helps) {
  const list = (Array.isArray(helps) ? helps : []).map(normalizeHelpEntry).filter(Boolean);
  if (list.length === 0) return '';
  const allD6 = list.every((h) => String(h.die).toLowerCase() === 'd6');
  if (allD6) {
    const names = list.map((h) => h.label).join(' and ');
    const die = list.length === 1 ? '[d6]' : `[${list.length}d6kh]`;
    return ` ${names} ${die}`;
  }
  const parts = list.map((h) => `${h.label} [${h.die}]`);
  return ` ${parts.join(' and ')}`;
}

/**
 * @param {object | null | undefined} el
 * @returns {number}
 */
export function characterHopeValue(el) {
  if (!el) return 0;
  return Number.isFinite(Number(el.hope)) ? Number(el.hope) : (el.maxHope ?? 6);
}

/**
 * @param {object | null | undefined} el
 * @param {Record<string, { hope?: number }>} [pendingCosts]
 * @returns {number}
 */
export function remainingHopeForCharacter(el, pendingCosts = {}) {
  if (!el?.instanceId) return 0;
  const pending = pendingCosts[el.instanceId]?.hope ?? 0;
  return characterHopeValue(el) - pending;
}

/**
 * Attacker resource costs plus each `_helpAlly` Hope row.
 *
 * @param {object | null | undefined} roll
 * @returns {{ instanceId: string, hope: number, stress: number, armorMark: number, armorClear: number }[]}
 */
export function collectRollResourceCostRows(roll) {
  const rows = [];
  if (roll?._attackerInstanceId) {
    const hope = (parseInt(roll._hopeCost, 10) || 0) + (parseInt(roll._experienceHopeCost, 10) || 0);
    const stress = parseInt(roll._stressCost, 10) || 0;
    const armorMark = parseInt(roll._armorMark, 10) || 0;
    const armorClear = parseInt(roll._armorClear, 10) || 0;
    if (hope !== 0 || stress !== 0 || armorMark !== 0 || armorClear !== 0) {
      rows.push({
        instanceId: roll._attackerInstanceId,
        hope,
        stress,
        armorMark,
        armorClear,
      });
    }
  }
  for (const raw of Array.isArray(roll?._helpAlly) ? roll._helpAlly : []) {
    const h = normalizeHelpEntry(raw);
    if (!h || !h.hopeCost) continue;
    rows.push({
      instanceId: h.instanceId,
      hope: h.hopeCost,
      stress: 0,
      armorMark: 0,
      armorClear: 0,
    });
  }
  return rows;
}

/**
 * @param {unknown} helps
 * @returns {{ instanceId: string, hope: number, stress: number, armorMark: number, armorClear: number }[]}
 */
export function collectIntentHelpCostRows(helps) {
  return (Array.isArray(helps) ? helps : [])
    .map(normalizeHelpEntry)
    .filter((h) => h && h.hopeCost > 0)
    .map((h) => ({
      instanceId: h.instanceId,
      hope: h.hopeCost,
      stress: 0,
      armorMark: 0,
      armorClear: 0,
    }));
}

/**
 * @param {Record<string, { hope?: number, stress?: number, armorMark?: number, armorClear?: number }>} base
 * @param {{ instanceId: string, hope?: number, stress?: number, armorMark?: number, armorClear?: number }[]} extraRows
 * @returns {Record<string, { hope: number, stress: number, armorMark: number, armorClear: number }>}
 */
export function mergePendingResourceCostMaps(base, extraRows) {
  const next = { ...(base || {}) };
  for (const row of extraRows || []) {
    if (!row?.instanceId) continue;
    const cur = next[row.instanceId] || { hope: 0, stress: 0, armorMark: 0, armorClear: 0 };
    next[row.instanceId] = {
      hope: cur.hope + (row.hope || 0),
      stress: cur.stress + (row.stress || 0),
      armorMark: cur.armorMark + (row.armorMark || 0),
      armorClear: cur.armorClear + (row.armorClear || 0),
    };
  }
  return next;
}

/**
 * @param {Record<string, { hope?: number, stress?: number, armorMark?: number, armorClear?: number }>} map
 * @param {{ instanceId: string, hope?: number, stress?: number, armorMark?: number, armorClear?: number }[]} rows
 * @returns {Record<string, { hope: number, stress: number, armorMark: number, armorClear: number }>}
 */
export function subtractPendingResourceCostRows(map, rows) {
  const next = { ...(map || {}) };
  for (const row of rows || []) {
    if (!row?.instanceId) continue;
    const cur = next[row.instanceId];
    if (!cur) continue;
    const merged = {
      hope: Math.max(0, (cur.hope || 0) - (row.hope || 0)),
      stress: Math.max(0, (cur.stress || 0) - (row.stress || 0)),
      armorMark: Math.max(0, (cur.armorMark || 0) - (row.armorMark || 0)),
      armorClear: Math.max(0, (cur.armorClear || 0) - (row.armorClear || 0)),
    };
    if (merged.hope === 0 && merged.stress === 0 && merged.armorMark === 0 && merged.armorClear === 0) {
      delete next[row.instanceId];
    } else {
      next[row.instanceId] = merged;
    }
  }
  return next;
}

/**
 * Helps to show as pending Hope: live intent, else held across the intent-clear → roll gap.
 * Once a matching roll is in the banner queue, roll costs own the pips.
 *
 * @param {{
 *   pendingIntent?: { intentId?: string, helps?: object[] } | null,
 *   held?: { intentId?: string | null, helps?: object[] } | null,
 *   pendingBanners?: object[],
 * }} args
 * @returns {object[]}
 */
export function resolveHeldHelpAllyRows({
  pendingIntent = null,
  held = null,
  pendingBanners = [],
} = {}) {
  const banners = Array.isArray(pendingBanners) ? pendingBanners : [];
  const matching = banners.some((b) => (
    b?._preRollIntentId
    && (
      b._preRollIntentId === pendingIntent?.intentId
      || b._preRollIntentId === held?.intentId
    )
  ));
  if (matching) return [];
  if (pendingIntent?.helps?.length) return pendingIntent.helps;
  if (held?.helps?.length) return held.helps;
  return [];
}

/**
 * @param {{
 *   intent?: object | null,
 *   intentId?: string,
 *   instanceId?: string,
 *   active?: boolean,
 *   viewer?: { role?: string, uid?: string | null, email?: string | null },
 *   isGm?: boolean,
 *   helperEl?: object | null,
 * }} args
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function validateHelpAllyRequest({
  intent = null,
  intentId,
  instanceId,
  active,
  viewer = {},
  isGm = false,
  helperEl = null,
} = {}) {
  if (!intent || (intentId && intent.intentId !== intentId)) {
    return { ok: false, status: 409, error: 'Intent no longer pending' };
  }
  if (!canViewerSeeIntent(intent, viewer)) {
    return { ok: false, status: 403, error: 'Cannot see this roll' };
  }
  if (!isGm && !isCharacterAssignedToPlayer(helperEl, { uid: viewer.uid, email: viewer.email })) {
    return { ok: false, status: 403, error: 'Not assigned to this character' };
  }
  if (isHelpAllyReactionIntent(intent)) {
    return { ok: false, status: 400, error: 'Cannot help on a reaction' };
  }
  const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
  if (instanceId && instanceId === actorId) {
    return { ok: false, status: 400, error: 'Cannot help yourself' };
  }
  if (!helperEl || helperEl.elementType !== 'character') {
    return { ok: false, status: 400, error: 'Unknown character' };
  }
  if (active) {
    const already = (Array.isArray(intent.helps) ? intent.helps : [])
      .some((h) => h?.instanceId === instanceId);
    if (!already && characterHopeValue(helperEl) < 1) {
      return { ok: false, status: 400, error: 'No Hope remaining' };
    }
  }
  return { ok: true };
}

/**
 * Merge one help row onto the in-memory intent (does not validate).
 *
 * @param {object} intent
 * @param {{
 *   instanceId: string,
 *   active: boolean,
 *   label?: string,
 *   helperEl?: object | null,
 *   viewer?: { uid?: string | null, email?: string | null },
 * }} args
 * @returns {object}
 */
export function applyHelpAllyToIntent(intent, {
  instanceId,
  active,
  label,
  helperEl = null,
  viewer = {},
} = {}) {
  if (!intent || typeof intent !== 'object') return intent;
  if (!active) {
    return {
      ...intent,
      helps: mergeHelpAllyEntry(intent.helps, { instanceId, active: false }),
      timestamp: Date.now(),
    };
  }
  const existing = (Array.isArray(intent.helps) ? intent.helps : [])
    .find((h) => h?.instanceId === instanceId);
  const emails = getAssignedPlayerEmails(helperEl);
  const entry = {
    instanceId,
    playerUid: helperEl?.assignedPlayerUid || viewer.uid || null,
    playerEmail: helperEl?.assignedPlayerEmail || emails[0] || viewer.email || null,
    label: (typeof label === 'string' && label.trim())
      ? label.trim()
      : (existing?.label || defaultHelpLabel(helperEl?.name)),
    hopeCost: existing?.hopeCost ?? 1,
    die: existing?.die || 'd6',
  };
  return {
    ...intent,
    helps: mergeHelpAllyEntry(intent.helps, entry),
    timestamp: Date.now(),
  };
}
