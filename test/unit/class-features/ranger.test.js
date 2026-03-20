import { describe, it, expect, vi } from 'vitest';
import Ranger from '../../../src/features/classes/Ranger.js';

const RangersFocus = Ranger["Ranger's Focus"];

describe("Ranger's Focus.onFeatureActivated", () => {
  it("sets focusTargetId on the Ranger when target is provided", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'ranger1' };
    const targetEl = { instanceId: 'adv1' };
    RangersFocus.onFeatureActivated({ targetEl, selfEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('ranger1', { focusTargetId: 'adv1' });
  });

  it("clears focusTargetId when no target is provided", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'ranger1' };
    RangersFocus.onFeatureActivated({ targetEl: null, selfEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('ranger1', { focusTargetId: null });
  });
});

describe("Ranger's Focus.onHpDealt", () => {
  it("marks Stress when dealing damage to Focus target", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv1' };
    RangersFocus.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).toHaveBeenCalledWith(1);
  });

  it("does NOT mark Stress for non-focus target", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv2' };
    RangersFocus.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).not.toHaveBeenCalled();
  });

  it("does NOT mark Stress when hpDealt < 1", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: 'adv1', markStress };
    const target = { instanceId: 'adv1' };
    RangersFocus.onHpDealt({ character, hpDealt: 0, target });
    expect(markStress).not.toHaveBeenCalled();
  });

  it("does nothing when no focusTargetId is set", () => {
    const markStress = vi.fn();
    const character = { focusTargetId: null, markStress };
    const target = { instanceId: 'adv1' };
    RangersFocus.onHpDealt({ character, hpDealt: 2, target });
    expect(markStress).not.toHaveBeenCalled();
  });
});
