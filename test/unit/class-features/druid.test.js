import { describe, it, expect, vi } from 'vitest';
import Druid from '../../../src/features/classes/Druid.js';

const mockBeastform = { id: 'srd-bst-agile-scout', name: 'Agile Scout', tier: 1 };

describe("Druid.onFeatureActivated", () => {
  it("sets activeBeastform when featureName is 'Beastform' and roll._beastform is present", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.onFeatureActivated({
      featureName: 'Beastform',
      selfEl,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).toHaveBeenCalledWith('druid1', { activeBeastform: mockBeastform });
  });

  it("sets activeBeastform when featureName is 'Evolution' and roll._beastform is present", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.onFeatureActivated({
      featureName: 'Evolution',
      selfEl,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).toHaveBeenCalledWith('druid1', { activeBeastform: mockBeastform });
  });

  it("does nothing when roll._beastform is absent", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.onFeatureActivated({
      featureName: 'Beastform',
      selfEl,
      updateActiveElement: updates,
      roll: {},
    });
    expect(updates).not.toHaveBeenCalled();
  });

  it("does nothing for irrelevant feature names", () => {
    const updates = vi.fn();
    Druid.onFeatureActivated({
      featureName: 'Wildtouch',
      selfEl: { instanceId: 'druid1' },
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).not.toHaveBeenCalled();
  });

  it("does nothing when selfEl is missing", () => {
    const updates = vi.fn();
    Druid.onFeatureActivated({
      featureName: 'Beastform',
      selfEl: null,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).not.toHaveBeenCalled();
  });
});
