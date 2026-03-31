import { describe, it, expect } from 'vitest';
import {
  collectBudgetFieldsWarnings,
  coerceIdCountRow,
  mergeIdCounts,
  normalizeAdversaryAdds,
  normalizeSyntheticAdversaryRequest,
  parseBpBreakdown,
  sumBpForAdversaryAdds,
  sumBpForSyntheticAdversaryRequests,
  totalEncounterPlanBp,
  validateEncounterSelections,
  validateFullEncounterPlan,
} from '../../src/encounter-ai-resolve.js';
import { sortAdversariesForEncounterCatalog } from '../../src/llm-encounter-builder.js';

describe('encounter-ai-resolve', () => {
  it('coerceIdCountRow rejects stat blocks', () => {
    expect(coerceIdCountRow({ id: 'x', hp_max: 5 })).toBeNull();
    expect(coerceIdCountRow({ id: 'x', count: 2 })).toEqual({ id: 'x', count: 2 });
  });

  it('mergeIdCounts sums duplicate ids', () => {
    expect(mergeIdCounts([{ id: 'a', count: 1 }, { id: 'a', count: 2 }])).toEqual([{ id: 'a', count: 3 }]);
  });

  it('normalizeAdversaryAdds drops non-id rows', () => {
    expect(
      normalizeAdversaryAdds([{ id: 'srd-adv-bear', count: 1 }, { name: 'oops' }]),
    ).toEqual([{ id: 'srd-adv-bear', count: 1, tier: 1, role: 'standard' }]);
  });

  it('normalizeSyntheticAdversaryRequest parses count', () => {
    const r = normalizeSyntheticAdversaryRequest({ concept: 'test', tier: 2, role: 'bruiser', count: 2 });
    expect(r).toMatchObject({ concept: 'test', tier: 2, role: 'bruiser', count: 2 });
  });

  it('sumBpForAdversaryAdds uses computeBattlePoints', () => {
    const meta = new Map([
      ['a', { role: 'standard', tier: 2 }],
      ['b', { role: 'standard', tier: 2 }],
    ]);
    expect(sumBpForAdversaryAdds([{ id: 'a', count: 1 }, { id: 'b', count: 1 }], meta, 4)).toBe(4);
  });

  it('sumBpForAdversaryAdds groups minions by party size (not 1 BP per minion)', () => {
    const meta = new Map([['m', { role: 'minion', tier: 1 }]]);
    expect(sumBpForAdversaryAdds([{ id: 'm', count: 8 }], meta, 4)).toBe(2);
    expect(sumBpForAdversaryAdds([{ id: 'm', count: 5 }], meta, 4)).toBe(2);
    const meta2 = new Map([
      ['m1', { role: 'minion', tier: 1 }],
      ['m2', { role: 'minion', tier: 1 }],
    ]);
    expect(sumBpForAdversaryAdds([{ id: 'm1', count: 4 }, { id: 'm2', count: 4 }], meta2, 4)).toBe(2);
  });

  it('validateEncounterSelections drops unknown ids', () => {
    const adversaryIdSet = new Set(['a']);
    const environmentIdSet = new Set(['e']);
    const adversaryMetaById = new Map([['a', { role: 'solo', tier: 2 }]]);
    const v = validateEncounterSelections({
      adversaryAdds: [{ id: 'a', count: 1 }, { id: 'bad', count: 9 }],
      environmentAdds: [{ id: 'e', count: 1 }],
      adversaryIdSet,
      environmentIdSet,
      remainingBattlePoints: 20,
      partySize: 4,
      adversaryMetaById,
    });
    expect(v.adversaryAdds).toEqual([{ id: 'a', count: 1 }]);
    expect(v.environmentAdds).toEqual([{ id: 'e', count: 1 }]);
    expect(v.warnings.some((w) => w.includes('bad'))).toBe(true);
  });
});

describe('sortAdversariesForEncounterCatalog', () => {
  it('orders same party tier before lower tiers', () => {
    const items = [
      { id: 't1', name: 'a', tier: 1, role: 'standard' },
      { id: 't2', name: 'b', tier: 2, role: 'standard' },
      { id: 't2b', name: 'c', tier: 2, role: 'horde' },
    ];
    const sorted = sortAdversariesForEncounterCatalog(items, 2);
    expect(sorted.map((x) => x.id)).toEqual(['t2', 't2b', 't1']);
  });
});

describe('synthetic encounter BP + full plan', () => {
  it('sumBpForSyntheticAdversaryRequests matches computeBattlePoints', () => {
    const reqs = [
      { concept: 'x', tier: 2, role: 'standard', count: 2 },
      { concept: 'y', tier: 2, role: 'minion', count: 4 },
    ];
    expect(sumBpForSyntheticAdversaryRequests(reqs, 4)).toBe(4 + 1);
  });

  it('totalEncounterPlanBp sums catalog and synthetic', () => {
    const meta = new Map([
      ['a', { role: 'standard', tier: 2 }],
      ['b', { role: 'minion', tier: 1 }],
    ]);
    const adds = [
      { id: 'a', count: 1 },
      { id: 'b', count: 4 },
    ];
    const synth = [{ concept: 'x', tier: 2, role: 'support', count: 1 }];
    expect(totalEncounterPlanBp(adds, meta, 4, synth)).toBe(2 + 1 + 1);
  });

  it('validateFullEncounterPlan reserves BP for synthetic before trimming catalog', () => {
    const adversaryMetaById = new Map([
      ['a', { role: 'standard', tier: 2 }],
    ]);
    const v = validateFullEncounterPlan({
      adversaryAdds: [{ id: 'a', count: 5 }],
      environmentAdds: [],
      needsSyntheticAdversaries: [{ concept: 'x', tier: 2, role: 'standard', count: 1 }],
      adversaryIdSet: new Set(['a']),
      environmentIdSet: new Set(),
      remainingBattlePoints: 6,
      partySize: 4,
      adversaryMetaById,
    });
    expect(v.totalBp).toBeLessThanOrEqual(6);
    expect(sumBpForSyntheticAdversaryRequests(v.needsSyntheticAdversaries, 4)).toBe(2);
  });

  it('parseBpBreakdown parses lines', () => {
    const lines = parseBpBreakdown([{ id: 'minion_pool', role: 'minion', count: 8, bp: 2 }]);
    expect(lines).toEqual([{ id: 'minion_pool', role: 'minion', count: 8, bp: 2 }]);
  });

  it('collectBudgetFieldsWarnings flags estimatedBp mismatch', () => {
    const w = collectBudgetFieldsWarnings({ estimatedBp: 5, bpBreakdown: [{ id: 'a', role: 'standard', count: 1, bp: 5 }] }, 4);
    expect(w.some((x) => x.includes('estimatedBp'))).toBe(true);
  });

  it('collectBudgetFieldsWarnings skips sloppy bpBreakdown when estimatedBp matches actual', () => {
    const w = collectBudgetFieldsWarnings(
      {
        estimatedBp: 15,
        bpBreakdown: [
          { id: 'a', role: 'standard', count: 1, bp: 10 },
          { id: 'b', role: 'minion', count: 4, bp: 10 },
        ],
      },
      15,
    );
    expect(w.some((x) => x.includes('bpBreakdown'))).toBe(false);
    expect(w.length).toBe(0);
  });
});
