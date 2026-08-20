import { describe, it, expect } from 'vitest';
import {
  applyTagTeamAction,
  applyTagTeamPartnerResult,
  canChooseTagTeamRoll,
  canEditTagTeamPartner,
  canToggleTagTeam,
  combineTagTeamDamage,
  resolveTagTeamBannerDamage,
  eligibleTagTeamPartners,
  extractTagTeamDamage,
  isLocalTagTeamPartnerPreRoll,
  isTagTeamMeta,
  isTagTeamOwnedBanner,
  isTagTeamPendingChoice,
  isLocalTagTeamPartnerMeta,
  isPendingTagTeamPartnerActor,
  isTagTeamReactionMeta,
  planTagTeamAckEffects,
  shouldShowTagTeamWaitBanner,
  stampTagTeamPartnerActionMeta,
  tagTeamSharedTargetId,
  seedTagTeamPartner,
  shouldHydrateSharedIntentOverLocalTagTeam,
  shouldWriteSharedPreRollIntentForTagTeam,
  tagTeamInitiationsBudget,
  tagTeamInitiationsRemaining,
  tagTeamInitiatorHopeCost,
  tagTeamPartnerReady,
  validateTagTeamRequest,
} from '../../src/client/lib/tag-team.js';

const ada = {
  instanceId: 'ada',
  elementType: 'character',
  name: 'Ada',
  hope: 5,
  maxHope: 6,
  assignedPlayerUid: 'player-a',
  assignedPlayerEmail: 'a@example.com',
};
const beau = {
  instanceId: 'beau',
  elementType: 'character',
  name: 'Beau',
  hope: 4,
  maxHope: 6,
  assignedPlayerUid: 'player-b',
  assignedPlayerEmail: 'b@example.com',
  _v2TagTeamPartnerHopeDiscount: 1,
};
const cara = {
  instanceId: 'cara',
  elementType: 'character',
  name: 'Cara',
};
const elements = [ada, beau, cara];
const GM = { role: 'gm', uid: 'gm-1', email: 'gm@example.com' };
const PLAYER_A = { role: 'player', uid: 'player-a', email: 'a@example.com' };
const PLAYER_B = { role: 'player', uid: 'player-b', email: 'b@example.com' };

const tableIntent = {
  intentId: 'int-1',
  characterInstanceId: 'ada',
  _initiatorUid: 'player-a',
  _initiatorEmail: 'a@example.com',
  _assignedPlayerEmails: ['a@example.com'],
  _assignedPlayerUid: 'player-a',
  _rollVisibility: 'table',
  pending: { meta: { _attackerInstanceId: 'ada', _weaponRangeFt: 5 } },
  _tagTeam: false,
  tagTeamPartner: null,
  tagTeamPartnerInstanceId: null,
};

describe('isTagTeamMeta / hide on reactions', () => {
  it('hides Tag Team on reaction and reaction-call meta', () => {
    expect(isTagTeamReactionMeta({ _isReaction: true })).toBe(true);
    expect(isTagTeamReactionMeta({ _reactionCall: true })).toBe(true);
    expect(isTagTeamMeta({ _isReaction: true })).toBe(false);
    expect(isTagTeamMeta({ _traitKey: 'agility' })).toBe(true);
  });

  it('identifies Tag Team result banners and pending choice', () => {
    expect(isTagTeamOwnedBanner({ _tagTeamIntentId: 'int-1' })).toBe(true);
    expect(isTagTeamPendingChoice({ _tagTeamIntentId: 'int-1' })).toBe(true);
    expect(isTagTeamPendingChoice({ _tagTeamIntentId: 'int-1', _tagTeamChosen: true })).toBe(false);
  });

  it('identifies the partner Duality overlay (not a reaction)', () => {
    expect(isLocalTagTeamPartnerMeta({ _tagTeamIntentId: 'int-1', _tagTeamRole: 'partner' })).toBe(true);
    expect(isLocalTagTeamPartnerMeta({ _tagTeamIntentId: 'int-1', _tagTeamRole: 'initiator' })).toBe(false);
    expect(isLocalTagTeamPartnerMeta({ _isReaction: true })).toBe(false);
  });
});

describe('eligibleTagTeamPartners / seed', () => {
  it('returns every other PC', () => {
    const ids = eligibleTagTeamPartners({
      actorInstanceId: 'ada',
      activeElements: elements,
    }).map((e) => e.instanceId);
    expect(ids).toEqual(['beau', 'cara']);
  });

  it('seeds the first other PC as partner', () => {
    const partner = seedTagTeamPartner(eligibleTagTeamPartners({
      actorInstanceId: 'ada',
      activeElements: elements,
    }));
    expect(partner).toEqual(expect.objectContaining({
      instanceId: 'beau',
      name: 'Beau',
      trait: null,
      status: 'pending',
    }));
  });
});

describe('canToggle / canEdit / canChoose', () => {
  it('lets the GM or initiator toggle', () => {
    expect(canToggleTagTeam(GM, tableIntent)).toBe(true);
    expect(canToggleTagTeam(PLAYER_A, tableIntent)).toBe(true);
    expect(canToggleTagTeam(PLAYER_B, tableIntent)).toBe(false);
  });

  it('does not allow Tag Team on a trait roll', () => {
    expect(canToggleTagTeam(GM, {
      ...tableIntent,
      pending: { meta: { _attackerInstanceId: 'ada', _traitKey: 'agility' } },
    })).toBe(false);
  });

  it('lets the assigned partner edit their row', () => {
    expect(canEditTagTeamPartner(PLAYER_B, 'beau', { activeElements: elements })).toBe(true);
    expect(canEditTagTeamPartner(PLAYER_A, 'beau', { activeElements: elements })).toBe(false);
    expect(canEditTagTeamPartner(GM, 'beau', { isGm: true, activeElements: elements })).toBe(true);
  });

  it('lets involved players choose a Duality', () => {
    const roll = {
      _tagTeamIntentId: 'int-1',
      _tagTeamInitiatorInstanceId: 'ada',
      _tagTeamPartnerInstanceId: 'beau',
    };
    expect(canChooseTagTeamRoll(GM, roll, elements)).toBe(true);
    expect(canChooseTagTeamRoll(PLAYER_A, roll, elements)).toBe(true);
    expect(canChooseTagTeamRoll(PLAYER_B, roll, elements)).toBe(true);
    expect(canChooseTagTeamRoll(
      { role: 'player', uid: 'other', email: 'o@example.com' },
      roll,
      elements,
    )).toBe(false);
    expect(canChooseTagTeamRoll(GM, { ...roll, _tagTeamChosen: true }, elements)).toBe(false);
  });
});

describe('session budget / Hope cost', () => {
  it('defaults to 1 initiation and 3 Hope', () => {
    expect(tagTeamInitiationsBudget(ada)).toBe(1);
    expect(tagTeamInitiationsRemaining(ada)).toBe(1);
    expect(tagTeamInitiatorHopeCost(null)).toBe(3);
  });

  it('adds Camaraderie extras and partner discount', () => {
    const warrior = { ...ada, tagTeamInitiationsUsedThisSession: 1 };
    expect(tagTeamInitiationsBudget(warrior, { _v2ExtraTagTeamInitiationsPerSession: 1 })).toBe(2);
    expect(tagTeamInitiationsRemaining(warrior, { _v2ExtraTagTeamInitiationsPerSession: 1 })).toBe(1);
    expect(tagTeamInitiatorHopeCost(beau)).toBe(2);
  });
});

describe('applyTagTeamAction / result', () => {
  it('toggle on seeds a partner and forces table visibility', () => {
    const next = applyTagTeamAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    expect(next._tagTeam).toBe(true);
    expect(next.tagTeamPartnerInstanceId).toBe('beau');
    expect(next.tagTeamPartner.status).toBe('pending');
    expect(next._rollVisibility).toBeUndefined();
    expect(next._groupRoll).toBe(false);
  });

  it('setPartner swaps the chosen PC', () => {
    const on = applyTagTeamAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    const swapped = applyTagTeamAction(on, { action: 'setPartner', instanceId: 'cara' }, {
      activeElements: elements,
    });
    expect(swapped.tagTeamPartnerInstanceId).toBe('cara');
    expect(swapped.tagTeamPartner.name).toBe('Cara');
  });

  it('setTrait and partner result mark the row ready', () => {
    const on = applyTagTeamAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    const withTrait = applyTagTeamAction(on, {
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'agility',
    });
    expect(withTrait.tagTeamPartner.trait).toBe('agility');
    const rolled = applyTagTeamPartnerResult(withTrait, {
      instanceId: 'beau',
      total: 18,
      success: true,
      rollDbId: 44,
    });
    expect(tagTeamPartnerReady(rolled.tagTeamPartner)).toBe(true);
    expect(rolled.tagTeamPartner.rollDbId).toBe(44);
  });
});

describe('validateTagTeamRequest', () => {
  it('rejects a missing intent and reactions', () => {
    expect(validateTagTeamRequest({
      intent: null,
      intentId: 'int-1',
      action: 'toggle',
      viewer: GM,
    }).status).toBe(409);
    expect(validateTagTeamRequest({
      intent: { ...tableIntent, pending: { meta: { _isReaction: true } } },
      intentId: 'int-1',
      action: 'toggle',
      active: true,
      viewer: GM,
      activeElements: elements,
    }).status).toBe(400);
  });

  it('rejects setTrait from the wrong player', () => {
    const on = applyTagTeamAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    expect(validateTagTeamRequest({
      intent: on,
      intentId: 'int-1',
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'agility',
      viewer: PLAYER_A,
      activeElements: elements,
      memberEl: beau,
    }).status).toBe(403);
    expect(validateTagTeamRequest({
      intent: on,
      intentId: 'int-1',
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'agility',
      viewer: PLAYER_B,
      activeElements: elements,
      memberEl: beau,
    }).ok).toBe(true);
  });

  it('accepts setPartnerPending from the partner and rejects a trait', () => {
    const on = applyTagTeamAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    expect(validateTagTeamRequest({
      intent: on,
      intentId: 'int-1',
      action: 'setPartnerPending',
      instanceId: 'beau',
      pending: { meta: { _weaponRangeFt: 5 } },
      viewer: PLAYER_B,
      activeElements: elements,
      memberEl: beau,
    }).ok).toBe(true);
    expect(validateTagTeamRequest({
      intent: on,
      intentId: 'int-1',
      action: 'setPartnerPending',
      instanceId: 'beau',
      pending: { meta: { _traitKey: 'agility' } },
      viewer: PLAYER_B,
      activeElements: elements,
      memberEl: beau,
    }).status).toBe(400);
  });
});

describe('partner sheet action / wait banner', () => {
  const on = applyTagTeamAction({
    ...tableIntent,
    targetInstanceId: 'goblin-1',
    pending: { meta: { _attackerInstanceId: 'ada', _selectedTargetInstanceId: 'goblin-1', _weaponRangeFt: 5 } },
  }, { action: 'toggle', active: true }, { activeElements: elements });

  it('identifies the pending partner and shared target', () => {
    expect(isPendingTagTeamPartnerActor(on, 'beau')).toBe(true);
    expect(isPendingTagTeamPartnerActor(on, 'ada')).toBe(false);
    expect(tagTeamSharedTargetId(on)).toBe('goblin-1');
  });

  it('stamps a sheet attack as the partner Duality with the same target', () => {
    const stamped = stampTagTeamPartnerActionMeta(on, {
      _attackerInstanceId: 'beau',
      _traitKey: 'agility',
      _weaponRangeFt: 5,
    });
    expect(stamped._tagTeamIntentId).toBe('int-1');
    expect(stamped._tagTeamRole).toBe('partner');
    expect(stamped._tagTeamPartnerInstanceId).toBe('beau');
    expect(stamped._selectedTargetInstanceId).toBe('goblin-1');
    expect(stamped._isReaction).toBe(false);
    expect(stamped._intentPanelForActionRoll).toBe(true);
  });

  it('does not stamp reactions, trait rolls, or mechanical resume dice', () => {
    expect(stampTagTeamPartnerActionMeta(on, { _isReaction: true })._tagTeamIntentId).toBeUndefined();
    expect(stampTagTeamPartnerActionMeta(on, { _skipPreRollIntent: true })._tagTeamIntentId).toBeUndefined();
    expect(stampTagTeamPartnerActionMeta(on, {
      _attackerInstanceId: 'beau',
      _traitKey: 'agility',
    })._tagTeamIntentId).toBeUndefined();
  });

  it('stores a partner attack pre-roll on the shared intent', () => {
    const withPending = applyTagTeamAction(on, {
      action: 'setPartnerPending',
      instanceId: 'beau',
      pending: {
        rollText: 'Beau Shortsword',
        displayName: 'Beau Shortsword',
        meta: { _attackerInstanceId: 'beau', _weaponRangeFt: 5 },
      },
      chips: [],
    });
    expect(withPending.tagTeamPartnerPending.characterInstanceId).toBe('beau');
    expect(shouldShowTagTeamWaitBanner({
      tagTeam: true,
      partner: withPending.tagTeamPartner,
      partnerPending: withPending.tagTeamPartnerPending,
    })).toBe(false);
    const cleared = applyTagTeamAction(withPending, {
      action: 'setPartnerPending',
      clear: true,
    });
    expect(cleared.tagTeamPartnerPending).toBeUndefined();
  });

  it('drops partner pending when the partner is swapped or Tag Team turns off', () => {
    const withPending = applyTagTeamAction(on, {
      action: 'setPartnerPending',
      instanceId: 'beau',
      pending: { meta: { _weaponRangeFt: 5 } },
    });
    const swapped = applyTagTeamAction(withPending, { action: 'setPartner', instanceId: 'cara' }, {
      activeElements: elements,
    });
    expect(swapped.tagTeamPartnerPending).toBeUndefined();
    const again = applyTagTeamAction(withPending, { action: 'toggle', active: false });
    expect(again.tagTeamPartnerPending).toBeUndefined();
  });

  it('shows the wait banner until the partner pre-roll is open', () => {
    expect(shouldShowTagTeamWaitBanner({
      tagTeam: true,
      partner: on.tagTeamPartner,
      localPartnerPreRoll: false,
    })).toBe(true);
    expect(shouldShowTagTeamWaitBanner({
      tagTeam: true,
      partner: on.tagTeamPartner,
      localPartnerPreRoll: true,
    })).toBe(false);
    expect(shouldShowTagTeamWaitBanner({
      tagTeam: true,
      partner: { ...on.tagTeamPartner, status: 'rolled' },
    })).toBe(false);
  });
});

describe('local partner overlay', () => {
  it('keeps the overlay while the shared intent matches', () => {
    const local = { localTagTeamPartner: true, tagTeamIntentId: 'int-1' };
    expect(isLocalTagTeamPartnerPreRoll(local)).toBe(true);
    expect(shouldHydrateSharedIntentOverLocalTagTeam(local, tableIntent)).toBe(false);
    expect(shouldWriteSharedPreRollIntentForTagTeam(local)).toBe(false);
    expect(shouldHydrateSharedIntentOverLocalTagTeam(local, { ...tableIntent, intentId: 'other' })).toBe(true);
  });
});

describe('combine damage / ack effects', () => {
  const phy = {
    subItems: [{ pre: 'damage ', input: '2d8', result: '11', post: ' phy' }],
  };
  const mag = {
    subItems: [{ pre: 'damage ', input: '1d10', result: '7', post: ' mag' }],
  };

  it('extracts damage totals and types', () => {
    expect(extractTagTeamDamage(phy)).toEqual({ total: 11, type: 'phy' });
  });

  it('sums peer damage and flags a type pick when types differ', () => {
    const same = combineTagTeamDamage(phy, {
      subItems: [{ pre: 'damage ', input: 'd8', result: '4', post: ' phy' }],
    });
    expect(same).toEqual({
      peerTotal: 4,
      type: 'phy',
      needsTypePick: false,
      types: ['phy'],
    });
    const mixed = combineTagTeamDamage(phy, mag);
    expect(mixed.peerTotal).toBe(7);
    expect(mixed.needsTypePick).toBe(true);
    expect(mixed.types).toEqual(['phy', 'mag']);
  });

  it('previews peer damage on each pending banner', () => {
    const live = resolveTagTeamBannerDamage(phy, mag);
    expect(live.peerTotal).toBe(7);
    expect(live.needsTypePick).toBe(true);
    expect(resolveTagTeamBannerDamage(mag, phy).peerTotal).toBe(11);
    const afterChoose = resolveTagTeamBannerDamage({
      ...phy,
      _tagTeamChosen: true,
      _tagTeamPeerDamageTotal: 7,
      _tagTeamDamageType: 'mag',
      _tagTeamNeedDamageTypePick: false,
      _tagTeamDamageTypes: ['phy', 'mag'],
    }, null);
    expect(afterChoose).toEqual({
      peerTotal: 7,
      type: 'mag',
      needsTypePick: false,
      types: ['phy', 'mag'],
    });
  });

  it('spends initiator Hope then grants Hope to every involved PC', () => {
    const { updates, fearDelta } = planTagTeamAckEffects({
      dominant: 'hope',
      involvedInstanceIds: ['ada', 'beau'],
      initiatorInstanceId: 'ada',
      hopeCost: 3,
      elements,
    });
    expect(fearDelta).toBe(0);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ instanceId: 'ada', hope: 3, tagTeamInitiationsUsedThisSession: 1 }),
      expect.objectContaining({ instanceId: 'beau', hope: 5 }),
    ]));
  });

  it('adds one Fear per involved PC on a Fear result', () => {
    const { updates, fearDelta } = planTagTeamAckEffects({
      dominant: 'fear',
      involvedInstanceIds: ['ada', 'beau'],
      initiatorInstanceId: 'ada',
      hopeCost: 3,
      elements,
    });
    expect(fearDelta).toBe(2);
    expect(updates).toEqual([
      expect.objectContaining({ instanceId: 'ada', hope: 2, tagTeamInitiationsUsedThisSession: 1 }),
    ]);
  });
});
