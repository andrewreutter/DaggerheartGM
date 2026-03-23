import { describe, it, expect } from 'vitest';

/**
 * Mirrors ResultBanner logic: augmented rolls mark prior subItems with `_preset` while the banner
 * is `resolved: false` during the extra-dice animation — only non-preset subs should use spinners.
 */
function dualityActionTotalKnown(resolved, actionItems, isStatic) {
  return (
    resolved
    || (actionItems.length > 0 && actionItems.every((s) => s._preset || isStatic(s.input)))
  );
}

function damageLineTotalKnown(resolved, damageSubs) {
  return resolved || (damageSubs.length > 0 && damageSubs.every((s) => s._preset));
}

describe('banner _preset during addDamageRoll / postBannerAddDamage', () => {
  it('shows duality action total when Hope/Fear are preset (extra damage rolling)', () => {
    const actionItems = [
      { pre: 'Hope', input: '1d12', _preset: true },
      { pre: 'Fear', input: '1d12', _preset: true },
    ];
    expect(dualityActionTotalKnown(false, actionItems, () => false)).toBe(true);
  });

  it('hides duality action total when a Hope/Fear die is actively rerolling', () => {
    const actionItems = [
      { pre: 'Hope', input: '1d12', _preset: false },
      { pre: 'Fear', input: '1d12', _preset: true },
    ];
    expect(dualityActionTotalKnown(false, actionItems, () => false)).toBe(false);
  });

  it('hides damage sum until the new damage sub-item finishes (not all preset)', () => {
    const damageSubs = [
      { pre: 'damage', _preset: true },
      { pre: 'Sneak 2d6 damage', _preset: false },
    ];
    expect(damageLineTotalKnown(false, damageSubs)).toBe(false);
  });

  it('shows damage sum when every damage line is preset', () => {
    const damageSubs = [{ pre: 'damage', _preset: true }];
    expect(damageLineTotalKnown(false, damageSubs)).toBe(true);
  });
});
