import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { ArcanaTouched } from '../../../../src/features-v2/abilities/Arcana/ArcanaTouched.js';
import { ChainLightning } from '../../../../src/features-v2/abilities/Arcana/ChainLightning.js';
import { BlinkOut } from '../../../../src/features-v2/abilities/Arcana/BlinkOut.js';
import { mockCharacter, mockGameState, mockRoll, runReviewAction } from '../helpers.js';

const fourArcana = () =>
  [1, 2, 3, 4].map((i) => ({ id: `card-${i}`, domain: 'arcana' }));

describe('Arcana Tier 2 — Arcana-Touched', () => {
  it('adds +1 to the spellcast trait when 4+ Arcana cards are in domainLoadout', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'presence',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
      domainLoadout: fourArcana(),
    });
    const { stats } = applyDeclarativeFeatures([{ ...ArcanaTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.presence).toBe(3);
    expect(stats.agility).toBe(0);
  });

  it('does not add trait bonus when fewer than 4 Arcana domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'presence',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
      domainLoadout: [{ id: 'a', domain: 'arcana' }, { id: 'b', domain: 'arcana' }],
    });
    const { stats } = applyDeclarativeFeatures([{ ...ArcanaTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.presence).toBe(2);
  });

  it('reviewAction chip swaps Hope/Fear when Arcana-Touched is active', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourArcana(),
    });
    const { chips } = runReviewAction(
      { ...ArcanaTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      }
    );
    const swap = chips.find((c) => c.name === 'Arcana-Touched — Swap Duality');
    expect(swap).toBeDefined();

    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Arcana-Touched',
      rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
    });
    const tbl = buildTableSnapshot(gs);
    const m = activateChip(swap, tbl, makeChipState());
    deductChipCosts(swap, tbl);
    const m2 = applyMutations(tbl);
    const mutations = [...m, ...m2];
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'swapHopeFearDice', payload: expect.objectContaining({ rollKey: 'action' }) })
    );
  });

  it('does not offer swap chip when fewer than 4 Arcana cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'x', domain: 'arcana' }],
    });
    const { chips } = runReviewAction(
      { ...ArcanaTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name === 'Arcana-Touched — Swap Duality')).toHaveLength(0);
  });
});

describe('Arcana Tier 2 — Chain Lightning', () => {
  it('card chip has stress cost 2', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const chips = collectChips([{ ...ChainLightning, _ownerInstanceId: 'char-1' }], 'card', buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' })));
    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(2);
  });
});

describe('Arcana Tier 2 — Blink Out', () => {
  it('card chip queues actionLoop on use', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Blink Out',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BlinkOut, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m.some((x) => x.type === 'actionLoop')).toBe(true);
  });
});
