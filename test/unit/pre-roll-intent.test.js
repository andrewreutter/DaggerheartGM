import { describe, it, expect } from 'vitest';
import {
  alignSelectedChips,
  applyRemoteSelectionSnapshot,
  remoteDifficultyDraftToApply,
  mergeIntentPatch,
  resolveDeleteIntentCas,
  serializeDisplayChips,
  serializePreRollIntent,
  shouldApplyRemoteIntentSnapshot,
  shouldShowPreRollBanner,
} from '../../src/client/lib/pre-roll-intent.js';
import { ROLL_VISIBILITY_TABLE } from '../../src/client/lib/roll-visibility.js';

const GM = { role: 'gm', uid: 'gm-1', email: 'gm@example.com' };
const PLAYER_A = { role: 'player', uid: 'player-a', email: 'a@example.com' };
const PLAYER_B = { role: 'player', uid: 'player-b', email: 'b@example.com' };
const SPECTATOR = { role: 'spectator' };

const baseIntent = {
  intentId: 'int-1',
  characterInstanceId: 'char-a',
  _initiatorUid: 'player-a',
  _initiatorEmail: 'a@example.com',
  _assignedPlayerEmails: ['a@example.com'],
  _assignedPlayerUid: 'player-a',
  selectedChips: [false, true],
  difficulty: 15,
  difficultyFinalized: false,
};

describe('mergeIntentPatch', () => {
  it('merges selection fields for both roles', () => {
    const next = mergeIntentPatch(baseIntent, {
      selectedChips: [true, true],
      experienceIndex: 1,
      advantages: ['Keen'],
      _rollVisibility: 'gm_and_player',
    }, { isGm: false });
    expect(next.selectedChips).toEqual([true, true]);
    expect(next.experienceIndex).toBe(1);
    expect(next.advantages).toEqual(['Keen']);
    expect(next._rollVisibility).toBe('gm_and_player');
  });

  it('ignores player writes to difficulty and difficultyFinalized', () => {
    const next = mergeIntentPatch(baseIntent, {
      difficulty: 22,
      difficultyFinalized: true,
    }, { isGm: false });
    expect(next.difficulty).toBe(15);
    expect(next.difficultyFinalized).toBe(false);
  });

  it('lets the GM update the live DC draft but not Finalize via PATCH', () => {
    const next = mergeIntentPatch(baseIntent, {
      difficulty: 22,
      difficultyFinalized: true,
    }, { isGm: true });
    expect(next.difficulty).toBe(22);
    expect(next.difficultyFinalized).toBe(false);
  });

  it('clamps GM difficulty to 5–30', () => {
    expect(mergeIntentPatch(baseIntent, { difficulty: 99 }, { isGm: true }).difficulty).toBe(30);
    expect(mergeIntentPatch(baseIntent, { difficulty: 1 }, { isGm: true }).difficulty).toBe(5);
  });

  it('returns null when there is no existing session', () => {
    expect(mergeIntentPatch(null, { difficulty: 12 }, { isGm: true })).toBeNull();
  });
});

describe('resolveDeleteIntentCas', () => {
  it('requires intentId', () => {
    expect(resolveDeleteIntentCas(baseIntent, null)).toEqual({
      ok: false,
      status: 400,
      error: 'intentId required',
    });
  });

  it('409s when the session is gone or the id does not match', () => {
    expect(resolveDeleteIntentCas(null, 'int-1').status).toBe(409);
    expect(resolveDeleteIntentCas(baseIntent, 'other').status).toBe(409);
  });

  it('succeeds when intentId matches', () => {
    expect(resolveDeleteIntentCas(baseIntent, 'int-1')).toEqual({ ok: true });
  });
});

describe('shouldShowPreRollBanner', () => {
  it('null intent (clear) is deliverable to everyone', () => {
    expect(shouldShowPreRollBanner(null, PLAYER_B)).toBe(true);
  });

  it('shows a public session to GM + initiator + assigned player, not other players or spectators', () => {
    const intent = { ...baseIntent, _rollVisibility: ROLL_VISIBILITY_TABLE };
    expect(shouldShowPreRollBanner(intent, GM)).toBe(true);
    expect(shouldShowPreRollBanner(intent, PLAYER_A)).toBe(true);
    expect(shouldShowPreRollBanner(intent, PLAYER_B)).toBe(false);
    expect(shouldShowPreRollBanner(intent, SPECTATOR)).toBe(false);
  });

  it('shows the banner to an assigned player who is not the initiator', () => {
    const intent = {
      ...baseIntent,
      _initiatorUid: 'gm-1',
      _initiatorEmail: 'gm@example.com',
      openedByRole: 'gm',
    };
    expect(shouldShowPreRollBanner(intent, PLAYER_A)).toBe(true);
    expect(shouldShowPreRollBanner(intent, PLAYER_B)).toBe(false);
  });
});

describe('shouldApplyRemoteIntentSnapshot', () => {
  it('skips an echo of our own write seq', () => {
    expect(shouldApplyRemoteIntentSnapshot({ clientWriteSeq: 4 }, { lastSentClientWriteSeq: 4 }))
      .toEqual({ apply: false, reason: 'own-echo' });
  });

  it('applies a remote write with a different seq', () => {
    expect(shouldApplyRemoteIntentSnapshot({ clientWriteSeq: 5 }, { lastSentClientWriteSeq: 4 }))
      .toEqual({ apply: true });
  });

  it('does not apply a null snapshot', () => {
    expect(shouldApplyRemoteIntentSnapshot(null)).toEqual({ apply: false, reason: 'null' });
  });
});

describe('applyRemoteSelectionSnapshot / serialize', () => {
  it('extracts selection + DC fields', () => {
    const snap = applyRemoteSelectionSnapshot({
      selectedChips: [true],
      experienceIndex: 0,
      advantages: ['Keen'],
      disadvantages: [],
      targetInstanceId: 'adv-1',
      _rollVisibility: 'gm_only',
      difficulty: 18,
      difficultyFinalized: true,
    });
    expect(snap.experienceIndex).toBe(0);
    expect(snap.targetInstanceId).toBe('adv-1');
    expect(snap.difficulty).toBe(18);
    expect(snap.difficultyFinalized).toBe(true);
  });

  it('serializes pending + display chips without functions', () => {
    const payload = serializePreRollIntent({
      intentId: 'x',
      characterName: 'Ada',
      characterInstanceId: 'c1',
      pending: { rollText: 'Ada Agility [d12] [d12]', displayName: 'Ada Agility', meta: { _traitKey: 'agility' } },
      chips: [
        { label: 'Test Toggle', description: 'ok', isToggle: true, onUse() {} },
        { _difficultyChip: true, label: 'Difficulty' },
      ],
      selectedChips: [true],
      needsDifficulty: true,
      difficulty: 15,
      openedByRole: 'player',
      clientWriteSeq: 1,
    });
    expect(payload.pending.meta._traitKey).toBe('agility');
    expect(payload.chips).toEqual([
      expect.objectContaining({ label: 'Test Toggle', isToggle: true }),
    ]);
    expect(payload.chips[0].onUse).toBeUndefined();
    expect(serializeDisplayChips([{ _difficultyChip: true }])).toEqual([]);
  });

  it('remoteDifficultyDraftToApply ignores an unchanged echo so a local draft stays', () => {
    expect(remoteDifficultyDraftToApply(15, null)).toBe(15);
    expect(remoteDifficultyDraftToApply(15, 15)).toBeNull();
    expect(remoteDifficultyDraftToApply(20, 15)).toBe(20);
    expect(remoteDifficultyDraftToApply(99, 15)).toBe(30);
  });

  it('alignSelectedChips pads and truncates', () => {
    expect(alignSelectedChips([true], 3)).toEqual([true, false, false]);
    expect(alignSelectedChips([true, true, true], 1)).toEqual([true]);
  });
});
