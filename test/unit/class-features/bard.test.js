import { describe, it, expect, vi } from 'vitest';
import Bard from '../../../src/features/classes/Bard.js';

describe("Bard.onFeatureActivated — Make a Scene", () => {
  it("applies difficultyMod -2 to a target adversary", () => {
    const updates = vi.fn();
    const targetEl = { instanceId: 'adv1', difficultyMod: 0 };
    Bard.onFeatureActivated({ featureName: 'Make a Scene', targetEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('adv1', { difficultyMod: -2 });
  });

  it("stacks difficultyMod when used multiple times", () => {
    const updates = vi.fn();
    const targetEl = { instanceId: 'adv1', difficultyMod: -2 };
    Bard.onFeatureActivated({ featureName: 'Make a Scene', targetEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('adv1', { difficultyMod: -4 });
  });

  it("does nothing when no targetEl is provided", () => {
    const updates = vi.fn();
    Bard.onFeatureActivated({ featureName: 'Make a Scene', targetEl: null, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });

  it("ignores irrelevant feature names", () => {
    const updates = vi.fn();
    const targetEl = { instanceId: 'adv1' };
    Bard.onFeatureActivated({ featureName: 'Other Feature', targetEl, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });
});
