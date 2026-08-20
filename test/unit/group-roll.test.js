import { describe, it, expect } from 'vitest';
import {
  applyGroupRollAction,
  applyGroupRollResult,
  canEditGroupMember,
  canToggleGroupRoll,
  eligibleGroupRollCharacters,
  evaluateGroupReactionOutcome,
  formatGroupRollBonus,
  groupRollModifier,
  groupRollsComplete,
  isGroupRollMeta,
  isGroupRollOwnedBanner,
  isGroupRollReactionMeta,
  seedGroupMembers,
  characterDisplayName,
  groupMemberLabel,
  pickGroupMemberRow,
  isLocalGroupReactionPreRoll,
  shouldHydrateSharedIntentOverLocal,
  shouldWriteSharedPreRollIntent,
  validateGroupRollRequest,
} from '../../src/client/lib/group-roll.js';

const ada = {
  instanceId: 'ada',
  elementType: 'character',
  name: 'Ada',
  assignedPlayerUid: 'player-a',
  assignedPlayerEmail: 'a@example.com',
};
const beau = {
  instanceId: 'beau',
  elementType: 'character',
  name: 'Beau',
  assignedPlayerUid: 'player-b',
  assignedPlayerEmail: 'b@example.com',
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
  _groupRoll: false,
  groupMembers: [],
};

describe('isGroupRollMeta / hide on reactions', () => {
  it('hides group roll on reaction and reaction-call meta', () => {
    expect(isGroupRollReactionMeta({ _isReaction: true })).toBe(true);
    expect(isGroupRollReactionMeta({ _reactionCall: true })).toBe(true);
    expect(isGroupRollMeta({ _isReaction: true })).toBe(false);
    expect(isGroupRollMeta({ _traitKey: 'agility' })).toBe(true);
  });

  it('identifies collaborator result banners', () => {
    expect(isGroupRollOwnedBanner({ _groupRollIntentId: 'int-1' })).toBe(true);
    expect(isGroupRollOwnedBanner({ _reactionCallRollDbId: 9 })).toBe(false);
  });
});

describe('eligibleGroupRollCharacters / seedGroupMembers', () => {
  it('returns every other PC (Skip is the opt-out)', () => {
    const ids = eligibleGroupRollCharacters({
      actorInstanceId: 'ada',
      activeElements: elements,
    }).map((c) => c.instanceId);
    expect(ids).toEqual(['beau', 'cara']);
  });

  it('seeds pending rows with null trait', () => {
    const seeded = seedGroupMembers([beau, cara]);
    expect(seeded).toEqual([
      { instanceId: 'beau', name: 'Beau', trait: null, status: 'pending' },
      { instanceId: 'cara', name: 'Cara', trait: null, status: 'pending' },
    ]);
  });

  it('keeps a local collaborator overlay from replacing the leader intent', () => {
    const overlay = { localGroupReaction: true, groupRollIntentId: 'int-1', intentId: 'local-9' };
    expect(isLocalGroupReactionPreRoll(overlay)).toBe(true);
    expect(shouldHydrateSharedIntentOverLocal(overlay, { intentId: 'int-1' })).toBe(false);
    expect(shouldHydrateSharedIntentOverLocal(overlay, { intentId: 'other' })).toBe(true);
    expect(shouldHydrateSharedIntentOverLocal({ intentId: 'int-1' }, { intentId: 'int-1' })).toBe(true);
    expect(shouldWriteSharedPreRollIntent(overlay)).toBe(false);
    expect(shouldWriteSharedPreRollIntent({ intentId: 'int-1' })).toBe(true);
  });

  it('prefers the optimistic local row so player Roll can fire before SSE setTrait', () => {
    const local = [{ instanceId: 'beau', trait: 'agility', status: 'pending' }];
    const intentRows = [{ instanceId: 'beau', trait: null, status: 'pending' }];
    expect(pickGroupMemberRow('beau', local, intentRows).trait).toBe('agility');
    expect(pickGroupMemberRow(undefined, local)).toBeNull();
    expect(pickGroupMemberRow('cara', null, undefined)).toBeNull();
  });

  it('falls back to the live table name when a stamped row is Unknown', () => {
    const nameless = { instanceId: 'dee', elementType: 'character', playerName: 'Dee' };
    expect(characterDisplayName(nameless)).toBe('Dee');
    expect(seedGroupMembers([nameless])[0].name).toBe('Dee');
    expect(groupMemberLabel(
      { instanceId: 'beau', name: 'Unknown' },
      [beau],
    )).toBe('Beau');
  });
});

describe('canToggleGroupRoll / canEditGroupMember', () => {
  it('lets the GM, initiator, and assigned-to-leader toggle', () => {
    expect(canToggleGroupRoll(GM, tableIntent)).toBe(true);
    expect(canToggleGroupRoll(PLAYER_A, tableIntent)).toBe(true);
    expect(canToggleGroupRoll(PLAYER_B, tableIntent)).toBe(false);
  });

  it('hides toggle on a reaction intent', () => {
    const reaction = {
      ...tableIntent,
      pending: { meta: { _isReaction: true, _attackerInstanceId: 'ada' } },
    };
    expect(canToggleGroupRoll(GM, reaction)).toBe(false);
  });

  it('lets the GM or the assigned player edit a collaborator row', () => {
    expect(canEditGroupMember(GM, 'beau', { isGm: true, memberEl: beau })).toBe(true);
    expect(canEditGroupMember(PLAYER_B, 'beau', { memberEl: beau })).toBe(true);
    expect(canEditGroupMember(PLAYER_A, 'beau', { memberEl: beau })).toBe(false);
  });
});

describe('groupRollModifier / formatGroupRollBonus / groupRollsComplete', () => {
  const members = [
    { instanceId: 'beau', status: 'success' },
    { instanceId: 'cara', status: 'failure' },
    { instanceId: 'dee', status: 'skipped' },
    { instanceId: 'eve', status: 'pending' },
  ];

  it('counts successes minus failures and ignores skip/pending', () => {
    expect(groupRollModifier(members)).toBe(0);
    expect(groupRollModifier([
      { status: 'success' },
      { status: 'success' },
      { status: 'failure' },
    ])).toBe(1);
  });

  it('formats +N / -N without a plus-minus', () => {
    expect(formatGroupRollBonus(2)).toBe(' + 2');
    expect(formatGroupRollBonus(-1)).toBe(' - 1');
    expect(formatGroupRollBonus(0)).toBe('');
    expect(formatGroupRollBonus(null)).toBe('');
  });

  it('is complete only when every row is success, failure, or skipped', () => {
    expect(groupRollsComplete(members)).toBe(false);
    expect(groupRollsComplete(members.filter((m) => m.status !== 'pending'))).toBe(true);
    expect(groupRollsComplete([])).toBe(true);
  });
});

describe('applyGroupRollAction / applyGroupRollResult', () => {
  it('toggle on seeds members and strips privacy', () => {
    const privateIntent = { ...tableIntent, _rollVisibility: 'gm_only' };
    const next = applyGroupRollAction(privateIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    expect(next.groupMembers.map((m) => m.name)).toEqual(['Beau', 'Cara']);
    expect(next._groupRoll).toBe(true);
    expect(next._rollVisibility).toBeUndefined();
    expect(next.groupMembers.map((m) => m.instanceId)).toEqual(['beau', 'cara']);
    expect(next.groupMembers.map((m) => m.name)).toEqual(['Beau', 'Cara']);
    expect(next.groupMembers.every((m) => m.status === 'pending' && m.trait == null)).toBe(true);
  });

  it('toggle on resolves names from library-style rows that omit name on the table copy', () => {
    const raw = [
      { instanceId: 'ada', elementType: 'character' },
      { instanceId: 'beau', elementType: 'character' },
      { instanceId: 'cara', elementType: 'character', playerName: 'Cara' },
    ];
    const resolved = [
      { instanceId: 'ada', elementType: 'character', name: 'Ada' },
      { instanceId: 'beau', elementType: 'character', name: 'Beau' },
      { instanceId: 'cara', elementType: 'character', name: 'Cara' },
    ];
    const next = applyGroupRollAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: raw,
    });
    expect(next.groupMembers.map((m) => m.name)).toEqual(['Unknown', 'Cara']);
    expect(next.groupMembers.map((m) => groupMemberLabel(m, resolved))).toEqual(['Beau', 'Cara']);
  });

  it('toggle off clears members', () => {
    const on = applyGroupRollAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    const off = applyGroupRollAction(on, { action: 'toggle', active: false });
    expect(off._groupRoll).toBe(false);
    expect(off.groupMembers).toEqual([]);
  });

  it('setTrait and skip only apply to pending rows', () => {
    const on = applyGroupRollAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    const withTrait = applyGroupRollAction(on, {
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'presence',
    });
    expect(withTrait.groupMembers.find((m) => m.instanceId === 'beau').trait).toBe('presence');
    const skipped = applyGroupRollAction(withTrait, { action: 'skip', instanceId: 'cara' });
    expect(skipped.groupMembers.find((m) => m.instanceId === 'cara').status).toBe('skipped');
    const afterSkip = applyGroupRollAction(skipped, {
      action: 'setTrait',
      instanceId: 'cara',
      trait: 'agility',
    });
    expect(afterSkip.groupMembers.find((m) => m.instanceId === 'cara').trait).toBeNull();
  });

  it('stamps success / failure / critical on a pending member', () => {
    const on = applyGroupRollAction(tableIntent, { action: 'toggle', active: true }, {
      activeElements: elements,
    });
    const hit = applyGroupRollResult(on, {
      instanceId: 'beau',
      total: 18,
      success: true,
      rollDbId: 44,
    });
    expect(hit.groupMembers.find((m) => m.instanceId === 'beau')).toMatchObject({
      status: 'success',
      total: 18,
      success: true,
      rollDbId: 44,
    });
    const crit = applyGroupRollResult(on, {
      instanceId: 'cara',
      total: 16,
      success: false,
      critical: true,
      rollDbId: 45,
    });
    expect(crit.groupMembers.find((m) => m.instanceId === 'cara').status).toBe('success');
    expect(crit.groupMembers.find((m) => m.instanceId === 'cara').critical).toBe(true);
  });
});

describe('evaluateGroupReactionOutcome', () => {
  it('treats a Duality critical as a success', () => {
    const out = evaluateGroupReactionOutcome({ total: 12, dominant: 'critical' }, 20);
    expect(out).toEqual({ total: 12, success: true, critical: true });
  });

  it('compares total to the banner DC', () => {
    expect(evaluateGroupReactionOutcome({ total: 16, dominant: 'hope' }, 15)?.success).toBe(true);
    expect(evaluateGroupReactionOutcome({ total: 14, dominant: 'fear' }, 15)?.success).toBe(false);
  });
});

describe('validateGroupRollRequest', () => {
  const onIntent = applyGroupRollAction(tableIntent, { action: 'toggle', active: true }, {
    activeElements: elements,
  });

  it('rejects a missing or mismatched intent', () => {
    expect(validateGroupRollRequest({
      intent: null,
      intentId: 'int-1',
      action: 'toggle',
      viewer: GM,
      isGm: true,
    }).status).toBe(409);
    expect(validateGroupRollRequest({
      intent: tableIntent,
      intentId: 'other',
      action: 'toggle',
      viewer: GM,
      isGm: true,
    }).status).toBe(409);
  });

  it('rejects a reaction session', () => {
    const reaction = {
      ...tableIntent,
      pending: { meta: { _isReaction: true, _attackerInstanceId: 'ada' } },
    };
    expect(validateGroupRollRequest({
      intent: reaction,
      intentId: 'int-1',
      action: 'toggle',
      active: true,
      viewer: GM,
      isGm: true,
      activeElements: elements,
    })).toMatchObject({ ok: false, status: 400 });
  });

  it('lets the GM toggle on when other PCs exist', () => {
    expect(validateGroupRollRequest({
      intent: tableIntent,
      intentId: 'int-1',
      action: 'toggle',
      active: true,
      viewer: GM,
      isGm: true,
      activeElements: elements,
    }).ok).toBe(true);
  });

  it('forbids an observer from toggling', () => {
    expect(validateGroupRollRequest({
      intent: tableIntent,
      intentId: 'int-1',
      action: 'toggle',
      active: true,
      viewer: PLAYER_B,
      activeElements: elements,
    }).status).toBe(403);
  });

  it('lets the assigned collaborator setTrait / skip', () => {
    expect(validateGroupRollRequest({
      intent: onIntent,
      intentId: 'int-1',
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'presence',
      viewer: PLAYER_B,
      memberEl: beau,
      activeElements: elements,
    }).ok).toBe(true);
    expect(validateGroupRollRequest({
      intent: onIntent,
      intentId: 'int-1',
      action: 'skip',
      instanceId: 'beau',
      viewer: PLAYER_B,
      memberEl: beau,
      activeElements: elements,
    }).ok).toBe(true);
  });

  it('forbids the leader from picking another PC’s trait', () => {
    expect(validateGroupRollRequest({
      intent: onIntent,
      intentId: 'int-1',
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'agility',
      viewer: PLAYER_A,
      memberEl: beau,
      activeElements: elements,
    }).status).toBe(403);
  });

  it('rejects an invalid trait', () => {
    expect(validateGroupRollRequest({
      intent: onIntent,
      intentId: 'int-1',
      action: 'setTrait',
      instanceId: 'beau',
      trait: 'charisma',
      viewer: PLAYER_B,
      memberEl: beau,
      activeElements: elements,
    }).status).toBe(400);
  });
});
