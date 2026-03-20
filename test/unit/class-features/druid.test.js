import { describe, it, expect, vi } from 'vitest';
import Druid from '../../../src/features/classes/Druid.js';

const mockBeastform = { id: 'srd-bst-agile-scout', name: 'Agile Scout', tier: 1 };

describe("Druid Beastform.onFeatureActivated", () => {
  it("sets activeBeastform when roll._beastform is present", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.Beastform.onFeatureActivated({
      selfEl,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).toHaveBeenCalledWith('druid1', { activeBeastform: mockBeastform });
  });

  it("does nothing when roll._beastform is absent", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.Beastform.onFeatureActivated({
      selfEl,
      updateActiveElement: updates,
      roll: {},
    });
    expect(updates).not.toHaveBeenCalled();
  });

  it("does nothing when selfEl is missing", () => {
    const updates = vi.fn();
    Druid.Beastform.onFeatureActivated({
      selfEl: null,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).not.toHaveBeenCalled();
  });
});

describe("Druid Evolution.onFeatureActivated", () => {
  it("sets activeBeastform when roll._beastform is present", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid.Evolution.onFeatureActivated({
      selfEl,
      updateActiveElement: updates,
      roll: { _beastform: mockBeastform },
    });
    expect(updates).toHaveBeenCalledWith('druid1', { activeBeastform: mockBeastform });
  });
});

describe("Druid Drop out of Beastform.onFeatureActivated", () => {
  it("clears activeBeastform and selectedBeastformAdvantage", () => {
    const updates = vi.fn();
    const selfEl = { instanceId: 'druid1' };
    Druid['Drop out of Beastform'].onFeatureActivated({ selfEl, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('druid1', { activeBeastform: null, selectedBeastformAdvantage: null });
  });
});

describe("Druid Elemental Incarnation.onDamageReceived", () => {
  it("clears activeChanneledElement when hpLoss >= 3", () => {
    const setFlag = vi.fn();
    const character = { instanceId: 'd1', activeChanneledElement: 'fire', setFlag };
    Druid['Elemental Incarnation'].onDamageReceived({ character, hpLoss: 3 });
    expect(setFlag).toHaveBeenCalledWith('activeChanneledElement', null);
  });
});
