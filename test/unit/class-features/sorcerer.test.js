import { describe, it, expect, vi } from 'vitest';
import Sorcerer from '../../../src/features/classes/Sorcerer.js';

const ChannelRawPower = Sorcerer['Channel Raw Power'];

describe("Sorcerer Channel Raw Power.requiresInput", () => {
  it("declares Channel Raw Power as requiring a number input", () => {
    const spec = ChannelRawPower.requiresInput;
    expect(spec).toBeDefined();
    expect(spec.type).toBe('number');
    expect(spec.min).toBeGreaterThanOrEqual(1);
  });
});

describe("Sorcerer Channel Raw Power.onFeatureActivated", () => {
  it("gains Hope equal to the card level for the 'Gain Hope' sub-feature", () => {
    const gainHope = vi.fn();
    const selfEl = { instanceId: 's1', gainHope, activeModifiers: [] };
    ChannelRawPower.onFeatureActivated({
      subFeatureName: 'Gain Hope',
      inputValue: 3,
      selfEl,
      updateActiveElement: vi.fn(),
    });
    expect(gainHope).toHaveBeenCalledWith(3);
  });

  it("defaults to level 1 when inputValue is null", () => {
    const gainHope = vi.fn();
    const selfEl = { instanceId: 's1', gainHope, activeModifiers: [] };
    ChannelRawPower.onFeatureActivated({
      subFeatureName: 'Gain Hope',
      inputValue: null,
      selfEl,
      updateActiveElement: vi.fn(),
    });
    expect(gainHope).toHaveBeenCalledWith(1);
  });

  it("adds a +bonus modifier for the 'Enhance Spell' sub-feature", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 's1', gainHope: vi.fn(), activeModifiers: [] };
    ChannelRawPower.onFeatureActivated({
      subFeatureName: 'Enhance your next spell',
      inputValue: 2,
      selfEl,
      updateActiveElement: updates,
    });
    expect(updates).toHaveBeenCalledWith('s1', expect.objectContaining({
      activeModifiers: expect.arrayContaining([
        expect.objectContaining({ name: 'Channel Raw Power', bonus: 4 }),
      ]),
    }));
  });
});
