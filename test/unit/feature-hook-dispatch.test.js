import { describe, it, expect, vi } from 'vitest';
import { runCharacterHook } from '../../src/client/lib/feature-hook-dispatch.js';

describe('runCharacterHook', () => {
  it('invokes onRoll with feature get/set backed by _originFeatureState', () => {
    const charEl = { instanceId: 'pc-1', _originFeatureState: {} };
    const updateActiveElement = vi.fn();
    const addRollBonus = vi.fn();
    const features = [
      {
        name: 'TestFeature',
        onRoll(ctx) {
          ctx.feature.set('flag', true);
          if (ctx.feature.get('flag', false)) addRollBonus(1);
        },
      },
    ];
    runCharacterHook(features, 'onRoll', {
      roll: { addRollBonus },
      characters: [],
      system: {},
      character: {},
      updateActiveElement,
      _characterEl: charEl,
    });
    expect(addRollBonus).toHaveBeenCalledWith(1);
    expect(updateActiveElement).toHaveBeenCalledWith('pc-1', {
      _originFeatureState: { TestFeature: { flag: true } },
    });
  });

  it('no-ops when no row implements the hook', () => {
    const spy = vi.fn();
    runCharacterHook([{ name: 'X' }], 'onRollComplete', { roll: {}, spy });
    expect(spy).not.toHaveBeenCalled();
  });
});
