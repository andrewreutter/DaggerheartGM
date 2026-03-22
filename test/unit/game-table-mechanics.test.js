import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  shouldUsePhase1RegistryFallback,
  resolveParryWeaponFeature,
  resolveWeaponOnBannerAckDescriptor,
  wrapEntity,
} from '../../src/client/lib/game-table-mechanics.js';

describe('game-table-mechanics (Phase D facade)', () => {
  let prev;

  beforeEach(() => {
    prev = globalThis.__DH_V2_DECLARATIVE_SHEET__;
  });

  afterEach(() => {
    if (prev === undefined) delete globalThis.__DH_V2_DECLARATIVE_SHEET__;
    else globalThis.__DH_V2_DECLARATIVE_SHEET__ = prev;
  });

  it('shouldUsePhase1RegistryFallback is true when V2 flag is off', () => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = false;
    expect(shouldUsePhase1RegistryFallback()).toBe(true);
  });

  it('shouldUsePhase1RegistryFallback is false when V2 flag is on', () => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
    expect(shouldUsePhase1RegistryFallback()).toBe(false);
  });

  it('resolveParryWeaponFeature prefers activeFeatures row', () => {
    const parryRow = { name: 'Parry', onBeforeDamageApplied: async () => 3 };
    const charEl = {
      activeFeatures: [parryRow],
      weapons: [{ feature: { name: 'Parry' } }],
    };
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
    expect(resolveParryWeaponFeature(charEl)).toBe(parryRow);
  });

  it('resolveWeaponOnBannerAckDescriptor returns null for unknown tag when V2 on', () => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
    expect(resolveWeaponOnBannerAckDescriptor({ activeFeatures: [] }, 'TotallyFakeTag')).toBe(null);
  });

  it('wrapEntity mutates stress via updateActiveElement', () => {
    const updates = [];
    const el = { instanceId: 'a', maxStress: 6, currentStress: 0 };
    const w = wrapEntity(el, (id, u) => updates.push([id, u]));
    w.markStress(2);
    expect(updates).toEqual([['a', { currentStress: 2 }]]);
  });
});
