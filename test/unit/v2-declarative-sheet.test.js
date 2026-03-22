import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  expandSrdAncestryIdsToV2Keys,
  resolveSrdAncestryRowToV2Keys,
  mergeV2DeclarativeSheetOverlay,
  buildV2RegistryWithSrdItems,
} from '../../src/client/lib/v2-declarative-sheet.js';
import v2registry from '../../src/features-v2/registry.js';

describe('v2-declarative-sheet', () => {
  beforeEach(() => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
  });
  afterEach(() => {
    delete globalThis.__DH_V2_DECLARATIVE_SHEET__;
  });

  it('resolveSrdAncestryRowToV2Keys maps Human + High Stamina to Human.HighStamina', () => {
    const keys = resolveSrdAncestryRowToV2Keys(
      {
        name: 'Human',
        features: [{ name: 'High Stamina', description: 'x' }],
      },
      v2registry.ancestries
    );
    expect(keys).toContain('Human.HighStamina');
  });

  it('expandSrdAncestryIdsToV2Keys resolves via ancestriesById', () => {
    const srdData = {
      ancestriesById: {
        'srd-anc-human': {
          name: 'Human',
          features: [{ name: 'High Stamina' }],
        },
      },
    };
    const keys = expandSrdAncestryIdsToV2Keys(['srd-anc-human'], srdData, v2registry.ancestries);
    expect(keys).toContain('Human.HighStamina');
  });

  it('mergeV2DeclarativeSheetOverlay adds weaponRenderHints for Pompous when Presence > 0', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {
        'w-test': {
          id: 'w-test',
          name: 'Gaudy Blade',
          tier: 1,
          trait: 'Agility',
          range: 'Melee',
          damage: 'd8',
          features: [{ name: 'Pompous', description: 'Presence 0 or lower' }],
        },
      },
      armorById: {},
      classesById: {},
      subclassesById: {},
      communitiesById: {},
    };

    const raw = {
      instanceId: 'pc1',
      classId: 'srd-cls-warrior',
      primaryWeaponId: 'w-test',
      traits: { presence: 2, agility: 1, strength: 0, finesse: 0, instinct: 0, knowledge: 0 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      baseTraits: {},
      level: 1,
    };

    const recomputed = {
      ...raw,
      weapons: [{ name: 'Gaudy Blade', trait: 'Agility', damage: 'd8', feature: { name: 'Pompous' }, id: 'wep_0' }],
    };

    const merged = mergeV2DeclarativeSheetOverlay(recomputed, raw, srdData, {});
    expect(merged.weaponRenderHints['w-test']).toEqual(
      expect.objectContaining({ isDisabled: true, disabledReason: 'Requires Presence ≤ 0' })
    );
  });

  it('buildV2RegistryWithSrdItems exposes weapons map for the loader', () => {
    const reg = buildV2RegistryWithSrdItems({
      weaponsById: { 'w-a': { id: 'w-a', name: 'Spear' } },
      armorById: {},
    });
    expect(reg.weapons['w-a'].name).toBe('Spear');
    expect(reg.classes['srd-cls-bard']).toBeDefined();
  });
});
