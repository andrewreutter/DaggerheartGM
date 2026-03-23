import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SafeHaven } from '../../../../src/features-v2/abilities/Codex/SafeHaven.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const feat = (overrides = {}) => ({ ...SafeHaven, _ownerInstanceId: 'char-1', ...overrides });

describe('Safe Haven (Codex)', () => {
  it('exposes Summon and Leave card chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    const chips = collectChips([feat()], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Safe Haven', 'Leave Safe Haven']);
  });

  it('Summon spends 2 Hope, sets summoned, and queues actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 4 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Safe Haven',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat()], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Safe Haven');
    expect(summon?.hopeCost).toBe(2);
    const m = activateChip(summon, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Safe Haven',
          key: 'summoned',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Safe Haven',
        }),
      })
    );
  });

  it('Leave clears summoned and queues actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Safe Haven',
      featureState: { 'Safe Haven': { summoned: true } },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat()], 'card', tbl);
    const leave = chips.find((c) => c.name === 'Leave Safe Haven');
    const m = activateChip(leave, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Safe Haven',
          key: 'summoned',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Leave Safe Haven',
        }),
      })
    );
  });

  it('adds +1 short and +1 long rest slot when summoned is true in feature state', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      featureState: { 'Safe Haven': { summoned: true } },
    });
    const { stats } = applyDeclarativeFeatures([feat()], char, {}, null);
    expect(stats.numShortRestSlots).toBe(1);
    expect(stats.numLongRestSlots).toBe(1);
  });

  it('does not add rest slots when Safe Haven is not summoned', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      featureState: { 'Safe Haven': { summoned: false } },
    });
    const { stats } = applyDeclarativeFeatures([feat()], char, {}, null);
    expect(stats.numShortRestSlots).toBe(0);
    expect(stats.numLongRestSlots).toBe(0);
  });
});
