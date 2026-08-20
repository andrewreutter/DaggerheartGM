/**
 * Group Rolls — core table mechanic (not a V2 feature module).
 *
 * The leader’s pending intent stays the single table session. Collaborators
 * open a local reaction pre-roll (experiences / chips / adv-disadv) vs the
 * banner DC; the leader roll gets +1 per success and −1 per failure. Skip
 * does not count. Always visible to the table.
 */

import { canViewerSeeIntent } from './roll-visibility.js';
import { isCharacterAssignedToPlayer } from './character-assignment.js';
import { TRAIT_KEYS } from './character-calc.js';
import { isPreRollBannerInteractive } from './pre-roll-intent.js';
import { formatReactionCallResultBadge } from './reaction-call-roster.js';
import { isDualityCritical } from './duality-roll-outcome.js';

const TERMINAL_STATUSES = new Set(['success', 'failure', 'skipped']);

/**
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isGroupRollReactionMeta(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return !!(meta._isReaction || meta._reactionCall);
}

/**
 * Hide Group roll on reaction / reaction-call sessions.
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isGroupRollMeta(meta) {
  return !isGroupRollReactionMeta(meta);
}

/**
 * Result banners owned by a group-roll collaborator reaction (no Ack/Cancel).
 * @param {unknown} roll
 * @returns {boolean}
 */
export function isGroupRollOwnedBanner(roll) {
  return roll != null && roll._groupRollIntentId != null && roll._groupRollIntentId !== '';
}

/**
 * @param {unknown} intent
 * @returns {boolean}
 */
export function isGroupRollReactionIntent(intent) {
  return isGroupRollReactionMeta(intent?.pending?.meta);
}

/**
 * Other PCs on the table (not the acting leader). All are listed; Skip is opt-out.
 *
 * @param {{
 *   actorInstanceId?: string | null,
 *   activeElements?: object[],
 * }} args
 * @returns {object[]}
 */
export function eligibleGroupRollCharacters({
  actorInstanceId = null,
  activeElements = [],
} = {}) {
  return (Array.isArray(activeElements) ? activeElements : []).filter((e) => (
    e
    && e.elementType === 'character'
    && e.instanceId
    && e.instanceId !== actorInstanceId
  ));
}

/**
 * GM, initiator, or assigned-to-leader. Hidden on reactions.
 *
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 * @param {object | null | undefined} intent
 * @returns {boolean}
 */
export function canToggleGroupRoll(viewer, intent) {
  if (!intent) return false;
  if (isGroupRollReactionIntent(intent)) return false;
  return isPreRollBannerInteractive(intent, viewer);
}

/**
 * GM may edit any row; a player may edit only their assigned PC.
 *
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 * @param {string} instanceId
 * @param {{
 *   isGm?: boolean,
 *   memberEl?: object | null,
 *   activeElements?: object[],
 * }} [opts]
 * @returns {boolean}
 */
export function canEditGroupMember(viewer, instanceId, {
  isGm = false,
  memberEl = null,
  activeElements = [],
} = {}) {
  if (!instanceId) return false;
  if (isGm || viewer?.role === 'gm') return true;
  const el = memberEl || (Array.isArray(activeElements) ? activeElements : [])
    .find((e) => e?.instanceId === instanceId) || null;
  return isCharacterAssignedToPlayer(el, { uid: viewer?.uid, email: viewer?.email });
}

/**
 * Live / library display name for a character element (table rows may omit `name`).
 * @param {object | null | undefined} el
 * @returns {string}
 */
export function characterDisplayName(el) {
  if (typeof el?.name === 'string' && el.name.trim()) return el.name.trim();
  if (typeof el?.playerName === 'string' && el.playerName.trim()) return el.playerName.trim();
  return '';
}

/**
 * Prefer a stamped member name, then the live table element (resolved library name).
 * @param {object | null | undefined} member
 * @param {object[]} [activeElements]
 * @returns {string}
 */
export function groupMemberLabel(member, activeElements = []) {
  const stamped = typeof member?.name === 'string' ? member.name.trim() : '';
  if (stamped && stamped !== 'Unknown') return stamped;
  const id = member?.instanceId != null ? String(member.instanceId) : '';
  const el = (Array.isArray(activeElements) ? activeElements : [])
    .find((e) => e?.instanceId != null && String(e.instanceId) === id) || null;
  return characterDisplayName(el) || stamped || 'Unknown';
}

/**
 * First matching group-member row across optimistic local state, then the intent snapshot.
 * Player Roll can fire before the setTrait SSE echo lands on `pendingIntent`.
 *
 * @param {string} instanceId
 * @param {...unknown} lists
 * @returns {object | null}
 */
export function pickGroupMemberRow(instanceId, ...lists) {
  const id = instanceId != null ? String(instanceId) : '';
  if (!id) return null;
  for (const list of lists) {
    const hit = (Array.isArray(list) ? list : []).find((m) => (
      m?.instanceId != null && String(m.instanceId) === id
    ));
    if (hit) return hit;
  }
  return null;
}

/**
 * Collaborator reaction sheet opened on this viewer only (does not POST /intent).
 * @param {object | null | undefined} banner
 * @returns {boolean}
 */
export function isLocalGroupReactionPreRoll(banner) {
  return !!(banner?.localGroupReaction && banner?.groupRollIntentId);
}

/**
 * Keep a local collaborator overlay when the shared leader intent is still that group session.
 * @param {object | null | undefined} localBanner
 * @param {object | null | undefined} pendingIntent
 * @returns {boolean}
 */
export function shouldHydrateSharedIntentOverLocal(localBanner, pendingIntent) {
  if (!isLocalGroupReactionPreRoll(localBanner)) return true;
  if (!pendingIntent?.intentId) return true;
  return String(localBanner.groupRollIntentId) !== String(pendingIntent.intentId);
}

/**
 * PATCH / Cancel / DELETE must not write the leader intent while the overlay is open.
 * @param {object | null | undefined} localBanner
 * @returns {boolean}
 */
export function shouldWriteSharedPreRollIntent(localBanner) {
  return !isLocalGroupReactionPreRoll(localBanner);
}

/**
 * @param {object[]} characters
 * @returns {{ instanceId: string, name: string, trait: null, status: 'pending' }[]}
 */
export function seedGroupMembers(characters) {
  return (Array.isArray(characters) ? characters : [])
    .filter((c) => c?.instanceId)
    .map((c) => ({
      instanceId: String(c.instanceId),
      name: characterDisplayName(c) || 'Unknown',
      trait: null,
      status: 'pending',
    }));
}

/**
 * @param {unknown} members
 * @returns {number}
 */
export function groupRollModifier(members) {
  let successes = 0;
  let failures = 0;
  for (const m of Array.isArray(members) ? members : []) {
    if (m?.status === 'success') successes += 1;
    else if (m?.status === 'failure') failures += 1;
  }
  return successes - failures;
}

/**
 * @param {unknown} n
 * @returns {string}
 */
export function formatGroupRollBonus(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '';
  if (v > 0) return ` + ${v}`;
  return ` - ${Math.abs(v)}`;
}

/**
 * @param {unknown} members
 * @returns {boolean}
 */
export function groupRollsComplete(members) {
  const list = Array.isArray(members) ? members : [];
  if (list.length === 0) return true;
  return list.every((m) => TERMINAL_STATUSES.has(m?.status));
}

/**
 * Success uses the same DC math as {@link formatReactionCallResultBadge}.
 *
 * @param {object | null | undefined} roll
 * @param {number | null | undefined} difficulty
 * @returns {{ total: number, success: boolean, critical: boolean } | null}
 */
export function evaluateGroupReactionOutcome(roll, difficulty) {
  const badge = formatReactionCallResultBadge(roll, difficulty);
  if (!badge) return null;
  const critical = isDualityCritical(roll);
  return {
    total: badge.total,
    success: badge.success === true || critical,
    critical,
  };
}

/**
 * @param {object} intent
 * @param {{
 *   action?: string,
 *   instanceId?: string,
 *   trait?: string,
 *   active?: boolean,
 * }} body
 * @param {{
 *   eligibleCharacters?: object[],
 *   activeElements?: object[],
 * }} [ctx]
 * @returns {object}
 */
export function applyGroupRollAction(intent, body = {}, ctx = {}) {
  if (!intent || typeof intent !== 'object') return intent;
  const action = body.action;
  if (action === 'toggle') {
    if (body.active === true) {
      const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
      const chars = Array.isArray(ctx.eligibleCharacters)
        ? ctx.eligibleCharacters
        : eligibleGroupRollCharacters({
          actorInstanceId: actorId,
          activeElements: ctx.activeElements || [],
        });
      const next = {
        ...intent,
        _groupRoll: true,
        groupMembers: seedGroupMembers(chars),
        _tagTeam: false,
        tagTeamPartner: null,
        tagTeamPartnerInstanceId: null,
        timestamp: Date.now(),
      };
      delete next._rollVisibility;
      return next;
    }
    return {
      ...intent,
      _groupRoll: false,
      groupMembers: [],
      timestamp: Date.now(),
    };
  }
  if (action === 'setTrait') {
    const instanceId = String(body.instanceId || '').trim();
    const trait = typeof body.trait === 'string' ? body.trait : null;
    if (!instanceId || !TRAIT_KEYS.includes(trait)) return intent;
    return {
      ...intent,
      groupMembers: (Array.isArray(intent.groupMembers) ? intent.groupMembers : []).map((m) => (
        m?.instanceId === instanceId && m.status === 'pending'
          ? { ...m, trait }
          : m
      )),
      timestamp: Date.now(),
    };
  }
  if (action === 'skip') {
    const instanceId = String(body.instanceId || '').trim();
    if (!instanceId) return intent;
    return {
      ...intent,
      groupMembers: (Array.isArray(intent.groupMembers) ? intent.groupMembers : []).map((m) => (
        m?.instanceId === instanceId && m.status === 'pending'
          ? { ...m, status: 'skipped' }
          : m
      )),
      timestamp: Date.now(),
    };
  }
  return intent;
}

/**
 * @param {object} intent
 * @param {{ instanceId: string, total: number, success: boolean, rollDbId?: number, critical?: boolean }} result
 * @returns {object}
 */
export function applyGroupRollResult(intent, {
  instanceId,
  total,
  success,
  rollDbId,
  critical = false,
} = {}) {
  if (!intent || typeof intent !== 'object') return intent;
  const id = String(instanceId || '').trim();
  if (!id) return intent;
  const numericTotal = Number(total);
  return {
    ...intent,
    groupMembers: (Array.isArray(intent.groupMembers) ? intent.groupMembers : []).map((m) => {
      if (m?.instanceId !== id || m.status !== 'pending') return m;
      const ok = success === true || critical === true;
      return {
        ...m,
        status: ok ? 'success' : 'failure',
        total: Number.isFinite(numericTotal) ? numericTotal : 0,
        success: ok,
        critical: critical === true,
        rollDbId: rollDbId ?? null,
      };
    }),
    timestamp: Date.now(),
  };
}

/**
 * @param {{
 *   intent?: object | null,
 *   intentId?: string,
 *   action?: string,
 *   instanceId?: string,
 *   trait?: string,
 *   active?: boolean,
 *   viewer?: { role?: string, uid?: string | null, email?: string | null },
 *   isGm?: boolean,
 *   memberEl?: object | null,
 *   activeElements?: object[],
 * }} args
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function validateGroupRollRequest({
  intent = null,
  intentId,
  action,
  instanceId,
  trait,
  active,
  viewer = {},
  isGm = false,
  memberEl = null,
  activeElements = [],
} = {}) {
  if (!intent || (intentId && intent.intentId !== intentId)) {
    return { ok: false, status: 409, error: 'Intent no longer pending' };
  }
  if (!canViewerSeeIntent(intent, viewer)) {
    return { ok: false, status: 403, error: 'Cannot see this roll' };
  }
  if (isGroupRollReactionIntent(intent)) {
    return { ok: false, status: 400, error: 'Cannot start a group roll on a reaction' };
  }
  if (action === 'toggle') {
    if (!canToggleGroupRoll(viewer, intent)) {
      return { ok: false, status: 403, error: 'Cannot toggle group roll' };
    }
    if (active === true) {
      const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
      const eligible = eligibleGroupRollCharacters({
        actorInstanceId: actorId,
        activeElements,
      });
      if (eligible.length === 0) {
        return { ok: false, status: 400, error: 'No other characters on the table' };
      }
    }
    return { ok: true };
  }
  if (action !== 'setTrait' && action !== 'skip') {
    return { ok: false, status: 400, error: 'Unknown action' };
  }
  if (!intent._groupRoll) {
    return { ok: false, status: 400, error: 'Group roll is not active' };
  }
  const id = typeof instanceId === 'string' ? instanceId.trim() : '';
  if (!id) {
    return { ok: false, status: 400, error: 'instanceId required' };
  }
  const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
  if (id === actorId) {
    return { ok: false, status: 400, error: 'Leader cannot be a collaborator' };
  }
  const el = memberEl || (Array.isArray(activeElements) ? activeElements : [])
    .find((e) => e?.instanceId === id) || null;
  if (!el || el.elementType !== 'character') {
    return { ok: false, status: 400, error: 'Unknown character' };
  }
  if (!canEditGroupMember(viewer, id, { isGm, memberEl: el, activeElements })) {
    return { ok: false, status: 403, error: 'Not assigned to this character' };
  }
  const member = (Array.isArray(intent.groupMembers) ? intent.groupMembers : [])
    .find((m) => m?.instanceId === id);
  if (!member) {
    return { ok: false, status: 400, error: 'Not a group member' };
  }
  if (member.status !== 'pending') {
    return { ok: false, status: 400, error: 'Already resolved' };
  }
  if (action === 'setTrait' && !TRAIT_KEYS.includes(trait)) {
    return { ok: false, status: 400, error: 'Invalid trait' };
  }
  return { ok: true };
}
