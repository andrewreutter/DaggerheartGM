import { describe, it, expect } from 'vitest';
import {
  redactSessionCountdownsForAudience,
  redactEncounterNotesForAudience,
  redactTableStateForPlayerAudience,
  redactTableStateForSpectatorAudience,
  findSessionCountdownBySource,
  deriveKindFromCountdownLabel,
  parseLegacyCountdownKey,
  classifyDaggerheartRollOutcome,
  getDynamicAdvancementTicks,
  getSessionCountdownDynamicChartRows,
  computeSessionCountdownUpdatesFromRoll,
  rollIsPcActionRoll,
  normalizeSessionCountdownEntry,
  isCountdownStartDice,
  applyCountdownLoop,
  countdownCanLoop,
  countdownFieldsFromParsedCd,
  formatSessionCountdownValueLine,
  countdownShowsElaboratedStart,
} from '../../src/client/lib/session-countdowns.js';
import { parseAllCountdownValues } from '../../src/client/lib/helpers.js';

describe('redactSessionCountdownsForAudience', () => {
  it('returns state unchanged for gm audience', () => {
    const state = {
      sessionCountdowns: [{ id: '1', visibility: 'gm', label: 'Secret' }],
    };
    expect(redactSessionCountdownsForAudience(state, 'gm')).toBe(state);
  });

  it('filters gm-only rows for player audience', () => {
    const state = {
      sessionCountdowns: [
        { id: '1', visibility: 'players', label: 'Open' },
        { id: '2', visibility: 'gm', label: 'Hidden' },
      ],
    };
    const out = redactSessionCountdownsForAudience(state, 'player');
    expect(out.sessionCountdowns).toHaveLength(1);
    expect(out.sessionCountdowns[0].id).toBe('1');
    expect(out).not.toBe(state);
  });
});

describe('redactEncounterNotesForAudience', () => {
  it('returns state unchanged for gm audience', () => {
    const state = {
      elements: [{ instanceId: 'n1', elementType: 'note', id: 'a', visibility: 'gm' }],
    };
    expect(redactEncounterNotesForAudience(state, 'gm')).toBe(state);
  });

  it('removes gm-only notes from elements for player audience', () => {
    const state = {
      elements: [
        { instanceId: 'n1', elementType: 'note', id: 'a', visibility: 'players' },
        { instanceId: 'n2', elementType: 'note', id: 'b', visibility: 'gm' },
        { instanceId: 'c1', elementType: 'character', id: 'c' },
      ],
    };
    const out = redactEncounterNotesForAudience(state, 'player');
    expect(out.elements).toHaveLength(2);
    expect(out.elements.map((e) => e.instanceId)).toEqual(['n1', 'c1']);
    expect(out).not.toBe(state);
  });

  it('treats notes without visibility as player-visible', () => {
    const state = {
      elements: [{ instanceId: 'n1', elementType: 'note', id: 'a', body: 'x' }],
    };
    expect(redactEncounterNotesForAudience(state, 'player')).toBe(state);
  });
});

describe('redactTableStateForPlayerAudience', () => {
  it('applies countdown and note redaction', () => {
    const state = {
      sessionCountdowns: [{ id: '1', visibility: 'gm', label: 'S' }],
      elements: [
        { instanceId: 'n1', elementType: 'note', visibility: 'gm' },
        { instanceId: 'a1', elementType: 'adversary' },
      ],
    };
    const out = redactTableStateForPlayerAudience(state);
    expect(out.sessionCountdowns).toHaveLength(0);
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0].elementType).toBe('adversary');
  });

  it('removes adversaries hidden from players', () => {
    const state = {
      elements: [
        { instanceId: 'a1', elementType: 'adversary' },
        { instanceId: 'a2', elementType: 'adversary', visibleToPlayers: false },
        { instanceId: 'c1', elementType: 'character' },
      ],
    };
    const out = redactTableStateForPlayerAudience(state);
    expect(out.elements.map((e) => e.instanceId)).toEqual(['a1', 'c1']);
  });

  it('strips inviteLink for the player audience', () => {
    const state = {
      inviteLink: { token: 'secret', createdAt: '2026-01-01' },
      elements: [{ instanceId: 'a1', elementType: 'adversary' }],
    };
    const out = redactTableStateForPlayerAudience(state);
    expect(out.inviteLink).toBeUndefined();
    expect(out.elements).toHaveLength(1);
  });
});

describe('redactTableStateForSpectatorAudience', () => {
  it('strips assignment emails, playerEmails, and marks isPublic', () => {
    const state = {
      playerEmails: ['alice@example.com'],
      inviteLink: { token: 'secret' },
      elements: [
        {
          instanceId: 'c1',
          elementType: 'character',
          name: 'Briar',
          assignedPlayerEmail: 'alice@example.com',
          assignedPlayerUid: 'uid-1',
        },
        { instanceId: 'n1', elementType: 'note', visibility: 'gm' },
      ],
    };
    const out = redactTableStateForSpectatorAudience(state);
    expect(out.playerEmails).toEqual([]);
    expect(out.isPublic).toBe(true);
    expect(out.inviteLink).toBeUndefined();
    expect(out.elements.some((e) => e.elementType === 'note')).toBe(false);
    const char = out.elements.find((e) => e.instanceId === 'c1');
    expect(char.name).toBe('Briar');
    expect(char.assignedPlayerEmail).toBeUndefined();
    expect(char.assignedPlayerUid).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/@/);
  });
});

describe('findSessionCountdownBySource', () => {
  it('finds row by cardKey, featureKey, cdIdx', () => {
    const list = [
      { id: 'a', sourceRef: { cardKey: 'c', featureKey: 'f', cdIdx: 1 } },
    ];
    expect(findSessionCountdownBySource(list, 'c', 'f', 1)).toEqual(list[0]);
    expect(findSessionCountdownBySource(list, 'x', 'f', 1)).toBeUndefined();
  });
});

describe('deriveKindFromCountdownLabel', () => {
  it('maps label text to kind', () => {
    expect(deriveKindFromCountdownLabel('Progress Countdown')).toBe('progress');
    expect(deriveKindFromCountdownLabel('Consequence track')).toBe('consequence');
    expect(deriveKindFromCountdownLabel('Standard')).toBe('standard');
  });
});

describe('parseLegacyCountdownKey', () => {
  it('parses pipe-separated keys', () => {
    expect(parseLegacyCountdownKey('a|b|0')).toEqual({ cardKey: 'a', featureKey: 'b', cdIdx: 0 });
    expect(parseLegacyCountdownKey('x|y|z|2')).toEqual({ cardKey: 'x|y', featureKey: 'z', cdIdx: 2 });
  });
});

describe('classifyDaggerheartRollOutcome', () => {
  const mkRoll = (hope, fear, dc) => ({
    _difficulty: dc,
    subItems: [
      { pre: 'Hope', result: String(hope) },
      { pre: 'Fear', result: String(fear) },
    ],
  });

  it('returns null without DC', () => {
    const r = mkRoll(5, 3, undefined);
    expect(classifyDaggerheartRollOutcome(r)).toBeNull();
  });

  it('classifies failure with fear dominant', () => {
    expect(classifyDaggerheartRollOutcome(mkRoll(2, 5, 10))).toBe('failure_fear');
  });

  it('classifies critical when hope equals fear', () => {
    expect(classifyDaggerheartRollOutcome(mkRoll(4, 4, 8))).toBe('critical');
  });

  it('classifies success_hope when total meets DC and hope wins', () => {
    expect(classifyDaggerheartRollOutcome(mkRoll(6, 2, 8))).toBe('success_hope');
  });
});

describe('getDynamicAdvancementTicks', () => {
  it('returns SRD-aligned ticks per outcome', () => {
    expect(getDynamicAdvancementTicks('failure_fear')).toEqual({ progress: 0, consequence: 3 });
    expect(getDynamicAdvancementTicks('success_hope')).toEqual({ progress: 2, consequence: 0 });
    expect(getDynamicAdvancementTicks('critical')).toEqual({ progress: 3, consequence: 0 });
  });
});

describe('getSessionCountdownDynamicChartRows', () => {
  it('matches getDynamicAdvancementTicks for every row', () => {
    const rows = getSessionCountdownDynamicChartRows();
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(getDynamicAdvancementTicks(r.outcome)).toEqual({
        progress: r.progress,
        consequence: r.consequence,
      });
    }
  });
});

describe('rollIsPcActionRoll', () => {
  const els = [{ instanceId: 'pc1', elementType: 'character' }];

  it('is true for character attacker and normal roll', () => {
    expect(rollIsPcActionRoll({ _attackerInstanceId: 'pc1' }, els)).toBe(true);
  });

  it('is false for action/rest/silent or non-character', () => {
    expect(rollIsPcActionRoll({ _attackerInstanceId: 'pc1', _action: true }, els)).toBe(false);
    expect(rollIsPcActionRoll({ _attackerInstanceId: 'pc1', _rest: true }, els)).toBe(false);
    expect(rollIsPcActionRoll({ _attackerInstanceId: 'pc1', silent: true }, els)).toBe(false);
    expect(rollIsPcActionRoll({ _attackerInstanceId: 'adv1' }, [{ instanceId: 'adv1', elementType: 'adversary' }])).toBe(
      false
    );
  });
});

describe('computeSessionCountdownUpdatesFromRoll', () => {
  const els = [{ instanceId: 'pc1', elementType: 'character' }];
  const baseRoll = {
    _attackerInstanceId: 'pc1',
    _difficulty: 12,
    subItems: [
      { pre: 'Hope', result: '7' },
      { pre: 'Fear', result: '3' },
    ],
  };

  it('returns null when no session rows', () => {
    expect(computeSessionCountdownUpdatesFromRoll([], baseRoll, els)).toBeNull();
  });

  it('ticks standard auto countdown on PC action roll', () => {
    const list = [
      { id: 's1', kind: 'standard', autoStandard: true, current: 4 },
    ];
    const out = computeSessionCountdownUpdatesFromRoll(list, baseRoll, els);
    expect(out.updates).toEqual([{ id: 's1', current: 3 }]);
  });

  it('applies dynamic ticks to progress/consequence when autoDynamic and DC present', () => {
    const list = [
      { id: 'p1', kind: 'progress', autoDynamic: true, current: 10 },
      { id: 'c1', kind: 'consequence', autoDynamic: true, current: 10 },
    ];
    // Total 10 vs DC 10, hope dominant → success_hope → progress −2, consequence −0
    const roll = {
      _attackerInstanceId: 'pc1',
      _difficulty: 10,
      subItems: [
        { pre: 'Hope', result: '8' },
        { pre: 'Fear', result: '2' },
      ],
    };
    const out = computeSessionCountdownUpdatesFromRoll(list, roll, els);
    expect(out.updates.find((u) => u.id === 'p1').current).toBe(8);
    expect(out.updates.find((u) => u.id === 'c1')).toBeUndefined();
  });

  it('does not advance dynamic rows when outcome cannot be classified (no DC)', () => {
    const roll = { ...baseRoll, _difficulty: undefined };
    const list = [{ id: 'p1', kind: 'progress', autoDynamic: true, current: 5 }];
    const out = computeSessionCountdownUpdatesFromRoll(list, roll, els);
    expect(out).toBeNull();
  });

  it('does not auto-loop when a tick reaches 0 — only current changes', () => {
    const list = [
      { id: 's1', kind: 'standard', autoStandard: true, current: 1, start: 4, looping: 'reset' },
    ];
    const out = computeSessionCountdownUpdatesFromRoll(list, baseRoll, els);
    expect(out.updates).toEqual([{ id: 's1', current: 0 }]);
    expect(out.updates[0].start).toBeUndefined();
    expect(out.updates[0].looping).toBeUndefined();
  });
});

describe('normalizeSessionCountdownEntry looping + formula', () => {
  it('defaults looping to none and startPending to false', () => {
    const row = normalizeSessionCountdownEntry({ id: 'a', label: 'Clock', start: 4, current: 3 });
    expect(row.looping).toBe('none');
    expect(row.startPending).toBe(false);
    expect(row.startFormula).toBeUndefined();
  });

  it('keeps startFormula and startPending for dice until elaborated', () => {
    const row = normalizeSessionCountdownEntry({
      id: 'a',
      startFormula: '1d4',
      startPending: true,
      looping: 'reset',
    });
    expect(row.startFormula).toBe('1d4');
    expect(row.startPending).toBe(true);
    expect(row.looping).toBe('reset');
    expect(row.start).toBe(0);
    expect(row.current).toBe(0);
  });

  it('clears startPending when formula is not dice', () => {
    const row = normalizeSessionCountdownEntry({
      id: 'a',
      startFormula: '8',
      startPending: true,
    });
    expect(row.startPending).toBe(false);
    expect(row.startFormula).toBe('8');
  });
});

describe('isCountdownStartDice', () => {
  it('detects dice vs integer formulas', () => {
    expect(isCountdownStartDice('1d4')).toBe(true);
    expect(isCountdownStartDice('2d6+1')).toBe(true);
    expect(isCountdownStartDice('4')).toBe(false);
    expect(isCountdownStartDice('8')).toBe(false);
    expect(isCountdownStartDice('')).toBe(false);
  });
});

describe('applyCountdownLoop', () => {
  it('reset restores start to current', () => {
    expect(applyCountdownLoop({ start: 6, looping: 'reset' })).toEqual({ start: 6, current: 6 });
  });

  it('increasing adds 1 to start', () => {
    expect(applyCountdownLoop({ start: 4, looping: 'increasing' })).toEqual({ start: 5, current: 5 });
  });

  it('decreasing subtracts 1 with floor 0', () => {
    expect(applyCountdownLoop({ start: 1, looping: 'decreasing' })).toEqual({ start: 0, current: 0 });
    expect(applyCountdownLoop({ start: 0, looping: 'decreasing' })).toEqual({ start: 0, current: 0 });
  });

  it('re-roll total is the new base, then increasing/decreasing apply', () => {
    expect(applyCountdownLoop({ start: 4, startFormulaTotal: 2, looping: 'reset' })).toEqual({
      start: 2,
      current: 2,
    });
    expect(applyCountdownLoop({ start: 4, startFormulaTotal: 3, looping: 'increasing' })).toEqual({
      start: 4,
      current: 4,
    });
    expect(applyCountdownLoop({ start: 4, startFormulaTotal: 1, looping: 'decreasing' })).toEqual({
      start: 0,
      current: 0,
    });
  });
});

describe('countdownCanLoop', () => {
  it('requires looping mode, current 0, and not pending', () => {
    expect(countdownCanLoop({ looping: 'reset', current: 0, start: 4, startPending: false })).toBe(true);
    expect(countdownCanLoop({ looping: 'none', current: 0, start: 4 })).toBe(false);
    expect(countdownCanLoop({ looping: 'reset', current: 2, start: 4 })).toBe(false);
    expect(countdownCanLoop({ looping: 'reset', current: 0, start: 4, startPending: true })).toBe(false);
  });

  it('disables decreasing when start is already 0', () => {
    expect(countdownCanLoop({ looping: 'decreasing', current: 0, start: 0 })).toBe(false);
    expect(countdownCanLoop({ looping: 'decreasing', current: 0, start: 1 })).toBe(true);
  });
});

describe('countdownShowsElaboratedStart', () => {
  it('hides numeric start when it matches a vanilla formula', () => {
    expect(countdownShowsElaboratedStart({ startFormula: '8', start: 8, startPending: false })).toBe(false);
  });

  it('shows numeric start after a dice roll, not while pending', () => {
    expect(countdownShowsElaboratedStart({ startFormula: '1d4', start: 0, startPending: true })).toBe(false);
    expect(countdownShowsElaboratedStart({ startFormula: '1d4', start: 3, startPending: false })).toBe(true);
  });

  it('shows numeric start when increasing/decreasing moved it off the typed number', () => {
    expect(countdownShowsElaboratedStart({ startFormula: '4', start: 5, startPending: false })).toBe(true);
  });
});

describe('formatSessionCountdownValueLine', () => {
  it('shows formula while pending', () => {
    expect(formatSessionCountdownValueLine({ startPending: true, startFormula: '1d4', current: 0, start: 0 })).toBe('1d4');
    expect(formatSessionCountdownValueLine({ startPending: false, start: 6, current: 4 })).toBe('4 / 6');
  });
});

describe('countdownFieldsFromParsedCd', () => {
  it('copies looping and startFormula; dice stays pending', () => {
    const parsed = parseAllCountdownValues('Countdown (Loop 1d4)')[0];
    expect(countdownFieldsFromParsedCd(parsed)).toEqual({
      looping: 'reset',
      startFormula: '1d4',
      startPending: true,
      start: 0,
      current: 0,
    });
  });

  it('sets numeric start for Countdown (8)', () => {
    expect(countdownFieldsFromParsedCd(parseAllCountdownValues('Fear Countdown (8)')[0])).toEqual({
      looping: 'none',
      startFormula: '8',
      startPending: false,
      start: 8,
      current: 8,
    });
  });
});
