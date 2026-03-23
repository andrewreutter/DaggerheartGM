import { describe, it, expect } from 'vitest';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyV2BannerMutations } from '../../../../src/client/lib/table-ops.js';
import { Invigoration } from '../../../../src/features-v2/abilities/Splendor/Invigoration.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const SEP = '\x1f';

function tableForInvigoration(overrides = {}) {
  const caster = mockCharacter({
    instanceId: 'caster',
    hope: 4,
    tokenX: 0,
    tokenY: 0,
    ...overrides.caster,
  });
  const ally = mockCharacter({
    instanceId: 'ally',
    name: 'Ally PC',
    hope: 2,
    tokenX: 10,
    tokenY: 0,
    featureUsage: {
      'Second Wind': { used: true, cycle: 'rest' },
    },
    ...overrides.ally,
  });
  const gs = mockGameState({
    activeElements: [caster, ally],
    _ownerInstanceId: 'caster',
    _featureKey: 'Invigoration',
    action: {
      type: 'free',
      actorInstanceId: 'caster',
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
    rolls: undefined,
    _rng: overrides._rng,
    ...overrides.gameState,
  });
  return buildTableSnapshot(gs);
}

describe('Splendor — Invigoration', () => {
  it('exposes card chip with isSelect options when an ally in Close range has exhausted features', () => {
    const tbl = tableForInvigoration();
    const chips = collectChips([{ ...Invigoration, _ownerInstanceId: 'caster' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Invigoration');
    expect(main).toBeDefined();
    expect(typeof main.isSelect).toBe('function');
    const opts = main.isSelect(tbl);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].id).toContain(SEP);
  });

  it('on any d6 showing 6, spends Hope and clears that featureUsage key on the target', () => {
    const tbl = tableForInvigoration({
      _rng: () => 5 / 6,
    });
    const chips = collectChips([{ ...Invigoration, _ownerInstanceId: 'caster' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Invigoration');
    const selectedId = `ally${SEP}Second Wind${SEP}2`;
    const m = activateChip(main, tbl, makeChipState(), { selectedId });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'caster', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearFeatureUsageKey',
        payload: { instanceId: 'ally', featureKey: 'Second Wind' },
      })
    );
    expect(m.some((x) => x.type === 'actionLoop')).toBe(true);

    const allyEl = {
      instanceId: 'ally',
      elementType: 'character',
      name: 'Ally PC',
      hope: 2,
      featureUsage: { 'Second Wind': { used: true, cycle: 'rest' } },
    };
    const casterEl = {
      instanceId: 'caster',
      elementType: 'character',
      hope: 4,
      tokenX: 0,
      tokenY: 0,
    };
    const { updates } = applyV2BannerMutations([casterEl, allyEl], m, 'caster');
    const allyPatch = updates.find((u) => u.instanceId === 'ally');
    expect(allyPatch?.updates?.featureUsage).toBeDefined();
    expect(allyPatch.updates.featureUsage['Second Wind']).toBeUndefined();
  });

  it('does not clear featureUsage when no die shows 6', () => {
    const tbl = tableForInvigoration({ _rng: () => 0 });
    const chips = collectChips([{ ...Invigoration, _ownerInstanceId: 'caster' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Invigoration');
    const selectedId = `ally${SEP}Second Wind${SEP}1`;
    const m = activateChip(main, tbl, makeChipState(), { selectedId });
    expect(m.some((x) => x.type === 'clearFeatureUsageKey')).toBe(false);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'caster', amount: 1 }),
      })
    );
  });
});
