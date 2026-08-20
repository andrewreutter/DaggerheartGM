import { describe, it, expect } from 'vitest';
import {
  applyTagTeamAction,
  applyTagTeamPartnerResult,
  canChooseTagTeamRoll,
  canEditTagTeamPartner,
  canToggleTagTeam,
  combineTagTeamDamage,
  eligibleTagTeamPartners,
  extractTagTeamDamage,
  isLocalTagTeamPartnerPreRoll,
  isTagTeamMeta,
  isTagTeamOwnedBanner,
  isTagTeamPendingChoice,
  isLocalTagTeamPartnerMeta,
  isTagTeamReactionMeta,
  planTagTeamAckEffects,
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
  pending: { meta: { _attackerInstanceId: 'ada' } },
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
