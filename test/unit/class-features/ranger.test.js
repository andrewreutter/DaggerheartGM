import { describe, it, expect, vi } from 'vitest';
import Ranger from '../../../src/features/classes/Ranger.js';

describe("Ranger.onFeatureActivated", () => {
  it("sets focusTargetId on the Ranger when target is provided", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'ranger1' };
    const targetEl = { instanceId: 'adv1' };
    Ranger.onFeatureActivated({ featureName: "Ranger's Focus", targetEl, selfEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('ranger1', { focusTargetId: 'adv1' });
  });

  it("clears focusTargetId when no target is provided", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'ranger1' };
    Ranger.onFeatureActivated({ featureName: "Ranger's Focus", targetEl: null, selfEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('ranger1', { focusTargetId: null });
  });

  it("ignores irrelevant feature names", () => {
    const updates = vi.fn();
    Ranger.onFeatureActivated({ featureName: 'Some Other Feature', targetEl: { instanceId: 'adv1' }, selfEl: { instanceId: 'r1' }, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });
});

describe("Ranger.onHpDealt", () => {
  it("marks Stress when dealing damage to Focus target", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv1' };
    Ranger.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).toHaveBeenCalledWith(1);
  });

  it("does NOT mark Stress for non-focus target", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv2' };
    Ranger.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).not.toHaveBeenCalled();
  });

  it("does NOT mark Stress when hpDealt < 1", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv1' };
    Ranger.onHpDealt({ character, hpDealt: 0, target });
    expect(markStress).not.toHaveBeenCalled();
  });

  it("does nothing when no focusTargetId is set", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: null, markStress };
    const target = { instanceId: 'adv1' };
    Ranger.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).not.toHaveBeenCalled();
  });
});
