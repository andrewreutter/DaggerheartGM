import { describe, it, expect, vi } from 'vitest';
import Rogue from '../../../src/features/classes/Rogue.js';

describe("Rogue.computeModifierEligibility", () => {
  const sneakMod = { id: 'sneak-attack-r1', name: 'Sneak Attack', dice: 'd6', mode: 'roll' };

  it("returns true when Rogue is Cloaked", () => {
    const el = { instanceId: 'r1', conditions: 'Cloaked, Hidden', activeModifiers: [sneakMod] };
    const result = Rogue.computeModifierEligibility({ el, activeElements: [], mapConfig: {} });
    expect(result['sneak-attack-r1']).toBe(true);
  });

  it("returns false when no allies are in Melee range of any adversary and not Cloaked", () => {
    const el = { instanceId: 'r1', conditions: '', activeModifiers: [sneakMod], tokenX: 0, tokenY: 0 };
    const ally = { instanceId: 'a1', elementType: 'character', tokenX: 50, tokenY: 50 };
    const adv = { instanceId: 'adv1', tokenX: 60, tokenY: 60 };
    const result = Rogue.computeModifierEligibility({ el, activeElements: [el, ally, adv], mapConfig: {} });
    expect(result['sneak-attack-r1']).toBe(false);
  });

  it("returns true when an ally is within 5ft of an adversary", () => {
    const el = { instanceId: 'r1', conditions: '', activeModifiers: [sneakMod], tokenX: 100, tokenY: 100 };
    const ally = { instanceId: 'a1', elementType: 'character', tokenX: 0, tokenY: 0 };
    const adv = { instanceId: 'adv1', tokenX: 4, tokenY: 0 }; // 4ft from ally
    const result = Rogue.computeModifierEligibility({ el, activeElements: [el, ally, adv], mapConfig: {} });
    expect(result['sneak-attack-r1']).toBe(true);
  });

  it("returns empty object when no Sneak Attack mods present", () => {
    const el = { instanceId: 'r1', conditions: '', activeModifiers: [] };
    const result = Rogue.computeModifierEligibility({ el, activeElements: [], mapConfig: {} });
    expect(result).toEqual({});
  });
});

describe("Rogue.onDamageReceived", () => {
  it("removes Rogue's Dodge modifier when HP loss > 0", () => {
    const updates = vi.fn();
    const mod = { id: 'rogues-dodge-r1', name: "Rogue's Dodge", mode: 'roll' };
    const character = { instanceId: 'r1', activeModifiers: [mod] };
    Rogue.onDamageReceived({ character, hpLoss: 1, updateActiveElement: updates });
    expect(updates).toHaveBeenCalledWith('r1', { activeModifiers: [] });
  });

  it("does NOT remove modifier when hpLoss < 1", () => {
    const updates = vi.fn();
    const mod = { id: 'rogues-dodge-r1', name: "Rogue's Dodge", mode: 'roll' };
    const character = { instanceId: 'r1', activeModifiers: [mod] };
    Rogue.onDamageReceived({ character, hpLoss: 0, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });

  it("does nothing when no Rogue's Dodge modifier is present", () => {
    const updates = vi.fn();
    const character = { instanceId: 'r1', activeModifiers: [{ id: 'other', name: 'Rally Die' }] };
    Rogue.onDamageReceived({ character, hpLoss: 2, updateActiveElement: updates });
    expect(updates).not.toHaveBeenCalled();
  });
});
