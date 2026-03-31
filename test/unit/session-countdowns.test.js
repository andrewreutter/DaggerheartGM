import { describe, it, expect } from 'vitest';
import {
  redactSessionCountdownsForAudience,
  redactEncounterNotesForAudience,
  redactTableStateForPlayerAudience,
  findSessionCountdownBySource,
  deriveKindFromCountdownLabel,
  parseLegacyCountdownKey,
  classifyDaggerheartRollOutcome,
  getDynamicAdvancementTicks,
  getSessionCountdownDynamicChartRows,
  computeSessionCountdownUpdatesFromRoll,
  rollIsPcActionRoll,
} from '../../src/client/lib/session-countdowns.js';

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
});
