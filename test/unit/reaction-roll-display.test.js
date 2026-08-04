import { describe, expect, it } from 'vitest';
import { isReactionRoll, resolveDualityBannerSchemeKey } from '../../src/client/lib/reaction-roll-display.js';

describe('isReactionRoll', () => {
  it('is true when roll meta carries _isReaction', () => {
    expect(isReactionRoll({ _isReaction: true, dominant: 'fear' })).toBe(true);
  });

  it('is false for a normal action roll', () => {
    expect(isReactionRoll({ dominant: 'fear' })).toBe(false);
    expect(isReactionRoll({ _isReaction: false, dominant: 'hope' })).toBe(false);
  });

  it('is false for a null/undefined roll', () => {
    expect(isReactionRoll(null)).toBe(false);
    expect(isReactionRoll(undefined)).toBe(false);
  });
});

describe('resolveDualityBannerSchemeKey', () => {
  it('resolves to neutral for a reaction roll even when Fear is dominant', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: true, hasDuality: true, resolved: true, dominantFromPreset: false, isHope: false })
    ).toBe('neutral');
  });

  it('resolves to neutral for a reaction roll even when Hope is dominant', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: true, hasDuality: true, resolved: true, dominantFromPreset: false, isHope: true })
    ).toBe('neutral');
  });

  it('resolves to hope for a non-reaction resolved roll with Hope dominant', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: false, hasDuality: true, resolved: true, dominantFromPreset: false, isHope: true })
    ).toBe('hope');
  });

  it('resolves to fear for a non-reaction resolved roll with Fear dominant', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: false, hasDuality: true, resolved: true, dominantFromPreset: false, isHope: false })
    ).toBe('fear');
  });

  it('resolves to neutral while unresolved and dice are not preset, regardless of reaction flag', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: false, hasDuality: true, resolved: false, dominantFromPreset: false, isHope: true })
    ).toBe('neutral');
  });

  it('resolves to neutral when the roll has no Duality dice at all', () => {
    expect(
      resolveDualityBannerSchemeKey({ isReaction: false, hasDuality: false, resolved: true, dominantFromPreset: false, isHope: true })
    ).toBe('neutral');
  });
});
