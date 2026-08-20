/**
 * Tag Team Rolls — core table mechanic (not a V2 feature module).
 *
 * The initiator’s pending intent stays the single table session. The partner
 * takes a full distinct attack (same target) from their sheet; that opens a
 * Duality pre-roll that does not replace the leader session. A wait banner
 * shows until that partner pre-roll opens. Both pre-roll banners stay visible
 * to the table. Both result banners stay pending until someone chooses which
 * Duality applies; each pending banner previews the other’s damage on its
 * total. Mixed phy/mag types pick beside Use this roll. The discarded banner
 * is cancelled. Hope/Fear and the initiator’s 3 Hope + session slot are
 * resolved on Apply of the chosen roll.
 */

import { canViewerSeeIntent } from './roll-visibility.js';
import { isCharacterAssignedToPlayer } from './character-assignment.js';
import { TRAIT_KEYS } from './character-calc.js';
import { isPreRollBannerInteractive } from './pre-roll-intent.js';
import { isAttackRollMeta } from './action-roll-difficulty.js';
import {
  DEFAULT_TAG_TEAM_INITIATIONS_PER_SESSION,
  DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST,
} from '../../features-v2/engine/table.js';

const TERMINAL_STATUSES = new Set(['success', 'failure', 'rolled']);

/**
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isTagTeamReactionMeta(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return !!(meta._isReaction || meta._reactionCall);
}

/**
 * Partner Duality overlay (not a reaction) — hide the Action / Group / Tag Team selector.
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isLocalTagTeamPartnerMeta(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return !!(meta._tagTeamIntentId && meta._tagTeamRole === 'partner');
}

/**
 * Shared target the partner must use (initiator pre-roll or pending meta).
 * @param {object | null | undefined} intent
 * @returns {string | null}
 */
export function tagTeamSharedTargetId(intent) {
  if (!intent || typeof intent !== 'object') return null;
  const fromIntent = intent.targetInstanceId;
  if (fromIntent != null && fromIntent !== '') return String(fromIntent);
  const fromMeta = intent.pending?.meta?._selectedTargetInstanceId;
  if (fromMeta != null && fromMeta !== '') return String(fromMeta);
  return null;
}

/**
 * Pending Tag Team partner who has not rolled yet.
 * @param {object | null | undefined} intent
 * @param {string | null | undefined} actorInstanceId
 * @returns {boolean}
 */
export function isPendingTagTeamPartnerActor(intent, actorInstanceId) {
  if (!intent?._tagTeam || !intent.intentId || !actorInstanceId) return false;
  const partner = intent.tagTeamPartner;
  if (!partner || partner.status !== 'pending') return false;
  return String(partner.instanceId) === String(actorInstanceId);
}

/**
 * Stamp a sheet **attack** as the Tag Team partner’s distinct action (same target).
 * Trait rolls and other non-attacks are ignored. Skips reactions, group leftovers,
 * and mechanical `rollThenResume` dice.
 *
 * @param {object | null | undefined} intent
 * @param {object} [meta]
 * @returns {object}
 */
export function stampTagTeamPartnerActionMeta(intent, meta = {}) {
  if (!meta || typeof meta !== 'object') return meta;
  if (!intent?._tagTeam || !intent.intentId) return meta;
  if (!isAttackRollMeta(meta)) return meta;
  if (meta._isReaction || meta._reactionCall || meta._groupRollIntentId) return meta;
  if (meta._skipPreRollIntent || meta._v2PhysicalRollResume) return meta;
  if (meta._tagTeamIntentId && meta._tagTeamRole === 'partner') {
    const targetId = tagTeamSharedTargetId(intent);
    if (targetId && !meta._selectedTargetInstanceId) {
      return { ...meta, _selectedTargetInstanceId: targetId };
    }
    return meta;
  }
  const partnerId = intent.tagTeamPartner?.instanceId;
  if (!partnerId) return meta;
  const initiatorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
  const targetId = tagTeamSharedTargetId(intent);
  return {
    ...meta,
    _tagTeamIntentId: intent.intentId,
    _tagTeamRole: 'partner',
    _tagTeamInitiatorInstanceId: initiatorId ?? null,
    _tagTeamPartnerInstanceId: partnerId,
    ...(targetId ? { _selectedTargetInstanceId: targetId } : {}),
    _isReaction: false,
    _intentPanelForActionRoll: true,
    _deferExperienceToPreRoll: true,
  };
}

/**
 * Wait banner while the partner has not opened their own pre-roll yet.
 * @param {{
 *   tagTeam?: boolean,
 *   partner?: object | null,
 *   localPartnerPreRoll?: boolean,
 *   partnerPending?: object | null,
 * }} args
 * @returns {boolean}
 */
export function shouldShowTagTeamWaitBanner({
  tagTeam = false,
  partner = null,
  localPartnerPreRoll = false,
  partnerPending = null,
} = {}) {
  return !!(
    tagTeam
    && partner
    && partner.status === 'pending'
    && !localPartnerPreRoll
    && !partnerPending
  );
}

/**
 * Hide Tag Team on reaction / reaction-call sessions.
 * @param {unknown} meta
 * @returns {boolean}
 */
export function isTagTeamMeta(meta) {
  return !isTagTeamReactionMeta(meta);
}

/**
 * Result banners that belong to a Tag Team session (initiator or partner).
 * @param {unknown} roll
 * @returns {boolean}
 */
export function isTagTeamOwnedBanner(roll) {
  return roll != null && roll._tagTeamIntentId != null && roll._tagTeamIntentId !== '';
}

/**
 * Hide Apply until a Duality is chosen.
 * @param {unknown} roll
 * @returns {boolean}
 */
export function isTagTeamPendingChoice(roll) {
  return isTagTeamOwnedBanner(roll) && roll._tagTeamChosen !== true;
}

/**
 * @param {unknown} intent
 * @returns {boolean}
 */
export function isTagTeamReactionIntent(intent) {
  return isTagTeamReactionMeta(intent?.pending?.meta);
}

/**
 * Other PCs on the table (not the acting initiator).
 *
 * @param {{
 *   actorInstanceId?: string | null,
 *   activeElements?: object[],
 * }} args
 * @returns {object[]}
 */
export function eligibleTagTeamPartners({
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
 * GM, initiator, or assigned-to-initiator. Hidden on reactions.
 *
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 * @param {object | null | undefined} intent
 * @returns {boolean}
 */
export function canToggleTagTeam(viewer, intent) {
  if (!intent) return false;
  if (isTagTeamReactionIntent(intent)) return false;
  if (!isAttackRollMeta(intent.pending?.meta)) return false;
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
export function canEditTagTeamPartner(viewer, instanceId, {
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
 * GM or a player assigned to the initiator or the partner may pick which Duality applies.
 *
 * @param {{ role?: string, uid?: string | null, email?: string | null }} viewer
 * @param {object | null | undefined} roll
 * @param {object[]} [activeElements]
 * @returns {boolean}
 */
export function canChooseTagTeamRoll(viewer, roll, activeElements = []) {
  if (!isTagTeamOwnedBanner(roll) || roll._tagTeamChosen === true) return false;
  if (viewer?.role === 'gm') return true;
  const ids = [
    roll._tagTeamInitiatorInstanceId,
    roll._tagTeamPartnerInstanceId,
    roll._attackerInstanceId,
  ].filter(Boolean);
  return ids.some((id) => {
    const el = (Array.isArray(activeElements) ? activeElements : [])
      .find((e) => e?.instanceId === id) || null;
    return isCharacterAssignedToPlayer(el, { uid: viewer?.uid, email: viewer?.email });
  });
}

/**
 * Live / library display name for a character element.
 * @param {object | null | undefined} el
 * @returns {string}
 */
export function tagTeamCharacterDisplayName(el) {
  if (typeof el?.name === 'string' && el.name.trim()) return el.name.trim();
  if (typeof el?.playerName === 'string' && el.playerName.trim()) return el.playerName.trim();
  return '';
}

/**
 * @param {object | null | undefined} partner
 * @param {object[]} [activeElements]
 * @returns {string}
 */
export function tagTeamPartnerLabel(partner, activeElements = []) {
  const stamped = typeof partner?.name === 'string' ? partner.name.trim() : '';
  if (stamped && stamped !== 'Unknown') return stamped;
  const id = partner?.instanceId != null ? String(partner.instanceId) : '';
  const el = (Array.isArray(activeElements) ? activeElements : [])
    .find((e) => e?.instanceId != null && String(e.instanceId) === id) || null;
  return tagTeamCharacterDisplayName(el) || stamped || 'Unknown';
}

/**
 * Partner action sheet opened on this viewer only (does not POST /intent).
 * @param {object | null | undefined} banner
 * @returns {boolean}
 */
export function isLocalTagTeamPartnerPreRoll(banner) {
  return !!(banner?.localTagTeamPartner && banner?.tagTeamIntentId);
}

/**
 * Keep a local partner overlay when the shared initiator intent is still that session.
 * @param {object | null | undefined} localBanner
 * @param {object | null | undefined} pendingIntent
 * @returns {boolean}
 */
export function shouldHydrateSharedIntentOverLocalTagTeam(localBanner, pendingIntent) {
  if (!isLocalTagTeamPartnerPreRoll(localBanner)) return true;
  if (!pendingIntent?.intentId) return true;
  return String(localBanner.tagTeamIntentId) !== String(pendingIntent.intentId);
}

/**
 * @param {object | null | undefined} localBanner
 * @returns {boolean}
 */
export function shouldWriteSharedPreRollIntentForTagTeam(localBanner) {
  return !isLocalTagTeamPartnerPreRoll(localBanner);
}

/**
 * Core 1 + Camaraderie-style extras from the declarative overlay.
 *
 * @param {object | null | undefined} el
 * @param {object | null | undefined} displayEl
 * @returns {number}
 */
export function tagTeamInitiationsBudget(el, displayEl = el) {
  const extra = Math.max(0, Math.floor(Number(
    displayEl?._v2ExtraTagTeamInitiationsPerSession
    ?? displayEl?.extraTagTeamInitiationsPerSession
    ?? el?.extraTagTeamInitiationsPerSession
    ?? 0
  ) || 0));
  return DEFAULT_TAG_TEAM_INITIATIONS_PER_SESSION + extra;
}

/**
 * @param {object | null | undefined} el
 * @param {object | null | undefined} displayEl
 * @returns {number}
 */
export function tagTeamInitiationsRemaining(el, displayEl = el) {
  const used = Math.max(0, Math.floor(Number(el?.tagTeamInitiationsUsedThisSession) || 0));
  return Math.max(0, tagTeamInitiationsBudget(el, displayEl) - used);
}

/**
 * Core 3 Hope minus the partner’s Camaraderie-style discount.
 *
 * @param {object | null | undefined} partnerEl
 * @returns {number}
 */
export function tagTeamInitiatorHopeCost(partnerEl) {
  const disc = Math.max(0, Math.floor(Number(
    partnerEl?._v2TagTeamPartnerHopeDiscount
    ?? partnerEl?.tagTeamPartnerHopeDiscount
    ?? 0
  ) || 0));
  return Math.max(0, DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST - disc);
}

/**
 * @param {object[]} characters
 * @returns {{ instanceId: string, name: string, trait: null, status: 'pending' } | null}
 */
export function seedTagTeamPartner(characters) {
  const first = (Array.isArray(characters) ? characters : []).find((c) => c?.instanceId);
  if (!first) return null;
  return {
    instanceId: String(first.instanceId),
    name: tagTeamCharacterDisplayName(first) || 'Unknown',
    trait: null,
    status: 'pending',
  };
}

/**
 * @param {unknown} partner
 * @returns {boolean}
 */
export function tagTeamPartnerReady(partner) {
  if (!partner || typeof partner !== 'object') return false;
  return TERMINAL_STATUSES.has(partner.status);
}

/**
 * Dice-only damage on a banner (crit extra stays on the chosen Duality).
 *
 * @param {object | null | undefined} roll
 * @returns {{ total: number, type: string } | null}
 */
export function extractTagTeamDamage(roll) {
  const damageSubs = (roll?.subItems || []).filter((s) => /damage/i.test(s.pre || '') && s.input);
  if (damageSubs.length === 0) return null;
  const total = damageSubs.reduce((sum, s) => sum + (parseInt(s.result, 10) || 0), 0);
  const firstPost = String(damageSubs[0]?.post || '').trim().split(/\s+/)[0] || '';
  const type = /^[a-z]+$/.test(firstPost) ? firstPost : '';
  return { total, type };
}

/**
 * Sum both players’ damage dice. Types that differ need a pick beside Use this roll.
 *
 * @param {object | null | undefined} chosenRoll
 * @param {object | null | undefined} peerRoll
 * @returns {{
 *   peerTotal: number,
 *   type: string | null,
 *   needsTypePick: boolean,
 *   types: string[],
 * } | null}
 */
export function combineTagTeamDamage(chosenRoll, peerRoll) {
  const a = extractTagTeamDamage(chosenRoll);
  const b = extractTagTeamDamage(peerRoll);
  if (!a && !b) return null;
  const types = [a?.type, b?.type].filter(Boolean);
  const unique = [...new Set(types)];
  return {
    peerTotal: b?.total || 0,
    type: unique.length === 1 ? unique[0] : null,
    needsTypePick: unique.length > 1,
    types: unique,
  };
}

/**
 * Peer damage + type pick for a Tag Team result banner.
 * While both banners are pending, uses the live peer roll so each card can
 * preview the other's damage. After choose, uses stamped fields (peer is gone).
 *
 * @param {object | null | undefined} roll
 * @param {object | null | undefined} peerRoll
 * @returns {{
 *   peerTotal: number,
 *   type: string | null,
 *   needsTypePick: boolean,
 *   types: string[],
 * }}
 */
export function resolveTagTeamBannerDamage(roll, peerRoll = null) {
  if (peerRoll) {
    return combineTagTeamDamage(roll, peerRoll) || {
      peerTotal: 0,
      type: null,
      needsTypePick: false,
      types: [],
    };
  }
  if (roll?._tagTeamChosen) {
    const types = Array.isArray(roll._tagTeamDamageTypes) ? roll._tagTeamDamageTypes : [];
    return {
      peerTotal: Number(roll._tagTeamPeerDamageTotal) || 0,
      type: roll._tagTeamDamageType || (types.length === 1 ? types[0] : null) || null,
      needsTypePick: !!roll._tagTeamNeedDamageTypePick,
      types,
    };
  }
  return { peerTotal: 0, type: null, needsTypePick: false, types: [] };
}

/**
 * Spend initiator Hope + consume the session slot, then apply Tag Team Hope/Fear.
 * Spend runs first so a Hope result nets (cost − 1) on the initiator.
 *
 * @param {{
 *   dominant?: string | null,
 *   involvedInstanceIds?: string[],
 *   initiatorInstanceId?: string | null,
 *   hopeCost?: number,
 *   elements?: object[],
 * }} args
 * @returns {{ updates: object[], fearDelta: number }}
 */
export function planTagTeamAckEffects({
  dominant = null,
  involvedInstanceIds = [],
  initiatorInstanceId = null,
  hopeCost = DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST,
  elements = [],
} = {}) {
  const updates = [];
  const ids = (Array.isArray(involvedInstanceIds) ? involvedInstanceIds : []).filter(Boolean);
  const cost = Math.max(0, Math.floor(Number(hopeCost) || 0));
  const init = (Array.isArray(elements) ? elements : []).find((e) => e?.instanceId === initiatorInstanceId);
  if (init && cost > 0) {
    const maxHope = init.maxHope ?? 6;
    const current = init.hope ?? maxHope;
    const used = Math.max(0, Math.floor(Number(init.tagTeamInitiationsUsedThisSession) || 0));
    updates.push({
      instanceId: initiatorInstanceId,
      hope: Math.max(0, current - cost),
      tagTeamInitiationsUsedThisSession: used + 1,
    });
  }
  if (dominant === 'fear') {
    return { updates, fearDelta: ids.length };
  }
  if (dominant === 'hope' || dominant === 'critical') {
    for (const id of ids) {
      const el = (Array.isArray(elements) ? elements : []).find((e) => e?.instanceId === id);
      if (!el) continue;
      const existing = updates.find((u) => u.instanceId === id);
      const baseHope = existing?.hope ?? (el.hope ?? el.maxHope ?? 6);
      const maxHope = el.maxHope ?? 6;
      const nextHope = Math.min(baseHope + 1, maxHope);
      if (existing) existing.hope = nextHope;
      else updates.push({ instanceId: id, hope: nextHope });
    }
    return { updates, fearDelta: 0 };
  }
  return { updates, fearDelta: 0 };
}

/**
 * @param {object} intent
 * @param {{
 *   action?: string,
 *   instanceId?: string,
 *   trait?: string,
 *   active?: boolean,
 *   pending?: object,
 *   chips?: object[],
 *   clear?: boolean,
 *   chosenRollDbId?: number | string,
 * }} body
 * @param {{
 *   eligibleCharacters?: object[],
 *   activeElements?: object[],
 * }} [ctx]
 * @returns {object}
 */
export function applyTagTeamAction(intent, body = {}, ctx = {}) {
  if (!intent || typeof intent !== 'object') return intent;
  const action = body.action;
  if (action === 'toggle') {
    if (body.active === true) {
      const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
      const chars = Array.isArray(ctx.eligibleCharacters)
        ? ctx.eligibleCharacters
        : eligibleTagTeamPartners({
          actorInstanceId: actorId,
          activeElements: ctx.activeElements || [],
        });
      const partner = seedTagTeamPartner(chars);
      const next = {
        ...intent,
        _tagTeam: true,
        tagTeamPartner: partner,
        tagTeamPartnerInstanceId: partner?.instanceId ?? null,
        _groupRoll: false,
        groupMembers: [],
        timestamp: Date.now(),
      };
      delete next._rollVisibility;
      delete next.tagTeamPartnerPending;
      return next;
    }
    const off = {
      ...intent,
      _tagTeam: false,
      tagTeamPartner: null,
      tagTeamPartnerInstanceId: null,
      timestamp: Date.now(),
    };
    delete off.tagTeamPartnerPending;
    return off;
  }
  if (action === 'setPartnerPending') {
    if (!intent._tagTeam) return intent;
    if (body.clear === true) {
      const cleared = { ...intent, timestamp: Date.now() };
      delete cleared.tagTeamPartnerPending;
      return cleared;
    }
    const instanceId = String(body.instanceId || '').trim();
    if (!instanceId || intent.tagTeamPartner?.instanceId !== instanceId) return intent;
    const pending = body.pending && typeof body.pending === 'object' ? body.pending : null;
    if (!pending || !isAttackRollMeta(pending.meta)) return intent;
    return {
      ...intent,
      tagTeamPartnerPending: {
        characterInstanceId: instanceId,
        pending,
        chips: Array.isArray(body.chips) ? body.chips : [],
      },
      timestamp: Date.now(),
    };
  }
  if (action === 'setPartner') {
    const instanceId = String(body.instanceId || '').trim();
    if (!instanceId || !intent._tagTeam) return intent;
    const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
    if (instanceId === actorId) return intent;
    const el = (Array.isArray(ctx.activeElements) ? ctx.activeElements : [])
      .find((e) => e?.instanceId === instanceId && e.elementType === 'character') || null;
    if (!el) return intent;
    const next = {
      ...intent,
      tagTeamPartnerInstanceId: instanceId,
      tagTeamPartner: {
        instanceId,
        name: tagTeamCharacterDisplayName(el) || 'Unknown',
        trait: null,
        status: 'pending',
      },
      timestamp: Date.now(),
    };
    delete next.tagTeamPartnerPending;
    return next;
  }
  if (action === 'setTrait') {
    const instanceId = String(body.instanceId || '').trim();
    const trait = typeof body.trait === 'string' ? body.trait : null;
    if (!instanceId || !TRAIT_KEYS.includes(trait) || !intent.tagTeamPartner) return intent;
    if (intent.tagTeamPartner.instanceId !== instanceId) return intent;
    if (intent.tagTeamPartner.status !== 'pending') return intent;
    return {
      ...intent,
      tagTeamPartner: { ...intent.tagTeamPartner, trait },
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
export function applyTagTeamPartnerResult(intent, {
  instanceId,
  total,
  success,
  rollDbId,
  critical = false,
} = {}) {
  if (!intent || typeof intent !== 'object' || !intent.tagTeamPartner) return intent;
  const id = String(instanceId || '').trim();
  if (!id || intent.tagTeamPartner.instanceId !== id) return intent;
  if (intent.tagTeamPartner.status !== 'pending') return intent;
  const numericTotal = Number(total);
  const next = {
    ...intent,
    tagTeamPartner: {
      ...intent.tagTeamPartner,
      status: 'rolled',
      total: Number.isFinite(numericTotal) ? numericTotal : 0,
      success: success === true || critical === true,
      critical: critical === true,
      rollDbId: rollDbId ?? null,
    },
    timestamp: Date.now(),
  };
  delete next.tagTeamPartnerPending;
  return next;
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
export function validateTagTeamRequest({
  intent = null,
  intentId,
  action,
  instanceId,
  trait,
  active,
  pending,
  clear,
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
  if (isTagTeamReactionIntent(intent)) {
    return { ok: false, status: 400, error: 'Cannot start a Tag Team roll on a reaction' };
  }
  if (action === 'toggle') {
    if (!canToggleTagTeam(viewer, intent)) {
      return { ok: false, status: 403, error: 'Cannot toggle Tag Team' };
    }
    if (active === true) {
      const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
      const eligible = eligibleTagTeamPartners({
        actorInstanceId: actorId,
        activeElements,
      });
      if (eligible.length === 0) {
        return { ok: false, status: 400, error: 'No other characters on the table' };
      }
    }
    return { ok: true };
  }
  if (action === 'setPartnerPending') {
    if (!intent._tagTeam) {
      return { ok: false, status: 400, error: 'Tag Team is not active' };
    }
    const id = typeof instanceId === 'string' ? instanceId.trim() : '';
    if (clear === true) {
      if (!canToggleTagTeam(viewer, intent) && !canEditTagTeamPartner(viewer, id || intent.tagTeamPartner?.instanceId, { isGm, memberEl, activeElements })) {
        return { ok: false, status: 403, error: 'Cannot clear Tag Team partner action' };
      }
      return { ok: true };
    }
    if (!id) {
      return { ok: false, status: 400, error: 'instanceId required' };
    }
    if (intent.tagTeamPartner?.instanceId !== id) {
      return { ok: false, status: 400, error: 'Not the Tag Team partner' };
    }
    if (!isAttackRollMeta(pending?.meta)) {
      return { ok: false, status: 400, error: 'Tag Team partner must take an attack' };
    }
    const el = memberEl || (Array.isArray(activeElements) ? activeElements : [])
      .find((e) => e?.instanceId === id) || null;
    if (!el || el.elementType !== 'character') {
      return { ok: false, status: 400, error: 'Unknown character' };
    }
    if (!canEditTagTeamPartner(viewer, id, { isGm, memberEl: el, activeElements })) {
      return { ok: false, status: 403, error: 'Not assigned to this character' };
    }
    return { ok: true };
  }
  if (action !== 'setPartner' && action !== 'setTrait') {
    return { ok: false, status: 400, error: 'Unknown action' };
  }
  if (!intent._tagTeam) {
    return { ok: false, status: 400, error: 'Tag Team is not active' };
  }
  const id = typeof instanceId === 'string' ? instanceId.trim() : '';
  if (!id) {
    return { ok: false, status: 400, error: 'instanceId required' };
  }
  const actorId = intent.characterInstanceId || intent.pending?.meta?._attackerInstanceId;
  if (id === actorId) {
    return { ok: false, status: 400, error: 'Initiator cannot be the partner' };
  }
  const el = memberEl || (Array.isArray(activeElements) ? activeElements : [])
    .find((e) => e?.instanceId === id) || null;
  if (!el || el.elementType !== 'character') {
    return { ok: false, status: 400, error: 'Unknown character' };
  }
  if (action === 'setPartner') {
    if (!canToggleTagTeam(viewer, intent)) {
      return { ok: false, status: 403, error: 'Cannot change Tag Team partner' };
    }
    return { ok: true };
  }
  if (!canEditTagTeamPartner(viewer, id, { isGm, memberEl: el, activeElements })) {
    return { ok: false, status: 403, error: 'Not assigned to this character' };
  }
  if (intent.tagTeamPartner?.instanceId !== id) {
    return { ok: false, status: 400, error: 'Not the Tag Team partner' };
  }
  if (intent.tagTeamPartner?.status !== 'pending') {
    return { ok: false, status: 400, error: 'Already resolved' };
  }
  if (action === 'setTrait' && !TRAIT_KEYS.includes(trait)) {
    return { ok: false, status: 400, error: 'Invalid trait' };
  }
  return { ok: true };
}
