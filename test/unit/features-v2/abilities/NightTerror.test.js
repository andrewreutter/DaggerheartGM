import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { NightTerror } from '../../../../src/features-v2/abilities/Midnight/NightTerror.js';
import { mockCharacter, mockAdversary, mockGameState } from '../helpers.js';

describe('Midnight — Night Terror', () => {
  it('exposes a long-rest card chip with 2 Hope recall cost', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Night Terror',
        featureState: { 'Night Terror': {} },
      })
    );
    const chips = collectChips([NightTerror], 'card', tbl);
    const main = chips.find((c) => c.name === 'Night Terror');
    expect(main).toBeDefined();
    expect(main?.hopeCost).toBe(2);
    expect(main?.frequency).toBe('longRest');
  });

  it('queues actionLoop and stores chosen targets when targets are within Very Close', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advA = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const advB = mockAdversary({ instanceId: 'adv-2', tokenX: 0, tokenY: 5 });
    const gs = mockGameState({
      activeElements: [char, advA, advB],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Night Terror',
      featureState: { 'Night Terror': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([NightTerror], 'card', tbl);
    const main = chips.find((c) => c.name === 'Night Terror');
    expect(main).toBeDefined();

    const m = activateChip(main, tbl, makeChipState(), { selectedTargetIds: ['adv-1', 'adv-2'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Night Terror',
          key: 'nightTerrorTargets',
          value: ['adv-1', 'adv-2'],
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Night Terror',
          description: expect.stringContaining('Reaction Roll (16)'),
        }),
      })
    );
  });

  it('disables the card when no valid targets are within Very Close', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 80, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Night Terror',
        featureState: { 'Night Terror': {} },
      })
    );
    const chips = collectChips([NightTerror], 'card', tbl);
    const main = chips.find((c) => c.name === 'Night Terror');
    expect(main?.disabled).toBe(true);
  });

  it('does not queue mutations when selected targets are not in range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 80, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Night Terror',
      featureState: { 'Night Terror': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([NightTerror], 'card', tbl);
    const main = chips.find((c) => c.name === 'Night Terror');
    const m = activateChip(main, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    expect(m.filter((x) => x.type === 'actionLoop')).toHaveLength(0);
    expect(m.filter((x) => x.type === 'setFeatureState')).toHaveLength(0);
  });
});
