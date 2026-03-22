import { describe, it, expect, vi } from 'vitest';
import Bard from '../../../src/features/classes/Bard.js';

const MakeAScene = Bard['Make a Scene'];

describe("Bard Make a Scene.onFeatureActivated", () => {
  it("applies difficultyMod -2 to a target adversary", () => {
    const updates = vi.fn();
    const targetEl = { instanceId: 'adv1', difficultyMod: 0 };
    MakeAScene.onFeatureActivated({ targetEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('adv1', { difficultyMod: -2 });
  });

  it("stacks difficultyMod when used multiple times", () => {
    const updates = vi.fn();
    const targetEl = { instanceId: 'adv1', difficultyMod: -2 };
    MakeAScene.onFeatureActivated({ targetEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('adv1', { difficultyMod: -4 });
  });

  it("does nothing when no targetEl is provided", () => {
    const updates = vi.fn();
    MakeAScene.onFeatureActivated({ targetEl: null, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });
});
