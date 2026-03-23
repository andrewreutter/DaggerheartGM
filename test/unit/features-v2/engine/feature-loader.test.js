import { describe, it, expect } from 'vitest';
import {
  applyDeclarativeFeatures,
  mergeDeclarativeFeatureState,
  attachBeastformOptions,
  loadCharacterFeatures,
  resolveSourceScopeKey,
} from '../../../../src/features-v2/engine/feature-loader.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../../../src/features-v2/engine/feature-scope-keys.js';
import { Efficient } from '../../../../src/features-v2/ancestries/Clank.js';
import { CelestialTrance } from '../../../../src/features-v2/ancestries/Elf.js';
import { mockCharacter, mockGameState } from '../helpers.js';
import { Hopeful } from '../../../../src/features-v2/armor_properties/Hopeful.js';
import { FleetingShadow } from '../../../../src/features-v2/subclasses/Nightwalker.js';

describe('applyDeclarativeFeatures', () => {
  it('accumulates substituteArmorForHope from declarative armor features', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = {};
    const { substituteArmorForHope } = applyDeclarativeFeatures(
      [{ ...Hopeful, _ownerInstanceId: 'c1', _source: 'armor_property' }],
      char,
      table
    );
    expect(substituteArmorForHope).toBe(true);
  });

  it('accumulates CONV-011 rest slot passiveStatMods into stats', () => {
    const character = { traits: {} };
    const table = {};
    const { stats } = applyDeclarativeFeatures(
      [Efficient, CelestialTrance],
      character,
      table
    );
    expect(stats.numLongMovesInShortRest).toBe(1);
    expect(stats.numShortRestSlots).toBe(1);
    expect(stats.numLongRestSlots).toBe(1);
  });

  it('supports function values in passiveStatMods (e.g. (table) => table.me.proficiency)', () => {
    const char = mockCharacter({ instanceId: 'c1', proficiency: 2, armorThresholds: { major: 5, severe: 10 } });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));

    const feature = {
      name: 'DynamicMod',
      passiveStatMods: {
        majorThreshold: (t) => t.me?.proficiency ?? 1,
        severeThreshold: (t) => t.me?.proficiency ?? 1,
      },
      _ownerInstanceId: 'c1',
    };

    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.majorThreshold).toBe(7);   // 5 + 2
    expect(stats.severeThreshold).toBe(12); // 10 + 2
  });

  it('passes feature as second arg to passiveStatMods functions (e.g. for _weaponId lookup)', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      armorScore: 0,
      primaryWeapon: { id: 'w-test', name: 'Test Weapon', tier: 3, range: 'melee' },
    });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const feature = {
      name: 'TieredTest',
      passiveStatMods: {
        armorScore: (t) => {
          const tier = parseInt(String(t.source?.tier ?? 1), 10) || 1;
          return tier + 1;
        },
      },
      _ownerInstanceId: 'c1',
      _weaponId: 'w-test',
      _sourceObject: { id: 'w-test', name: 'Test Weapon', tier: 3, range: 'melee' },
    };
    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.armorScore).toBe(4); // tier 3 + 1
  });

  it('accumulates weaponRenderHints from weapon_property onRender mutating table.source', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeaponId: 'w1',
    });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));
    const feature = {
      name: 'RenderTest',
      onRender(t) {
        t.source.isDisabled = true;
        t.source.disabledReason = 'Test gate';
      },
      _ownerInstanceId: 'c1',
      _source: 'weapon_property',
      _weaponId: 'w1',
    };
    const { weaponRenderHints } = applyDeclarativeFeatures([feature], char, table);
    expect(weaponRenderHints).toEqual({ w1: { isDisabled: true, disabledReason: 'Test gate' } });
  });

  it('does not mutate the original weapon object when onRender sets table.source', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const weaponRow = { id: 'w1', name: 'Test', tier: 1, range: 'melee', trait: 'agility', damage: 'd6' };
    const feature = {
      name: 'RenderTest',
      onRender(t) {
        t.source.isDisabled = true;
      },
      _ownerInstanceId: 'c1',
      _source: 'weapon_property',
      _weaponId: 'w1',
      _sourceObject: weaponRow,
    };
    applyDeclarativeFeatures([feature], char, {});
    expect(weaponRow.isDisabled).toBeUndefined();
  });

  it('merges onRender hints for the same weapon (isDisabled OR)', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = {};
    const a = {
      name: 'A',
      onRender(t) {
        t.source.isDisabled = false;
      },
      _weaponId: 'w1',
      _ownerInstanceId: 'c1',
      _source: 'weapon_property',
    };
    const b = {
      name: 'B',
      onRender(t) {
        t.source.isDisabled = true;
        t.source.disabledReason = 'Blocked';
      },
      _weaponId: 'w1',
      _ownerInstanceId: 'c1',
      _source: 'weapon_property',
    };
    const { weaponRenderHints } = applyDeclarativeFeatures([a, b], char, table);
    expect(weaponRenderHints.w1.isDisabled).toBe(true);
    expect(weaponRenderHints.w1.disabledReason).toBe('Blocked');
  });

  it('returns rangeOverrides from features that declare them', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const feature = {
      name: 'RangeTest',
      rangeOverrides: { melee: 'veryClose' },
      _ownerInstanceId: 'c1',
    };
    const { rangeOverrides } = applyDeclarativeFeatures([feature], char, table);
    expect(rangeOverrides).toEqual({ melee: 'veryClose' });
  });

  it('mergeDeclarativeFeatureState merges table and character bags; character wins', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      featureState: { Reinforced: { reinforcedActive: true } },
    });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        featureState: { Reinforced: { reinforcedActive: false } },
      })
    );
    const merged = mergeDeclarativeFeatureState(char, table);
    expect(merged.Reinforced.reinforcedActive).toBe(true);
  });

  it('handles majorThreshold and severeThreshold as static passiveStatMods', () => {
    const char = mockCharacter({ instanceId: 'c1', armorThresholds: { major: 7, severe: 12 } });
    const table = {};

    const feature = {
      name: 'StaticThresholds',
      passiveStatMods: { majorThreshold: 3, severeThreshold: 3 },
      _ownerInstanceId: 'c1',
    };

    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.majorThreshold).toBe(10); // 7 + 3
    expect(stats.severeThreshold).toBe(15); // 12 + 3
  });

  it('accumulates extraTagTeamInitiationsPerSession and tagTeamPartnerHopeDiscount', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const { extraTagTeamInitiationsPerSession, tagTeamPartnerHopeDiscount } = applyDeclarativeFeatures(
      [
        {
          name: 'TagTeamExtra',
          extraTagTeamInitiationsPerSession: 1,
          tagTeamPartnerHopeDiscount: 1,
          _ownerInstanceId: 'c1',
        },
      ],
      char,
      {}
    );
    expect(extraTagTeamInitiationsPerSession).toBe(1);
    expect(tagTeamPartnerHopeDiscount).toBe(1);
  });

  it('merges contactsEverywhereSessionUses (default 1; mastery max 3)', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const base = applyDeclarativeFeatures(
      [{ name: 'Contacts Everywhere', _ownerInstanceId: 'c1' }],
      char,
      {}
    );
    expect(base.contactsEverywhereSessionUses).toBe(1);

    const withMastery = applyDeclarativeFeatures(
      [
        { name: 'Contacts Everywhere', _ownerInstanceId: 'c1' },
        { name: 'Reliable Backup', contactsEverywhereSessionUses: 3, _ownerInstanceId: 'c1' },
      ],
      char,
      {}
    );
    expect(withMastery.contactsEverywhereSessionUses).toBe(3);
  });

  it('merges shadowStepperVeryFarUnlocked from Fleeting Shadow', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const base = applyDeclarativeFeatures([], char, {});
    expect(base.shadowStepperVeryFarUnlocked).toBe(false);

    const withMastery = applyDeclarativeFeatures(
      [{ ...FleetingShadow, _ownerInstanceId: 'c1' }],
      char,
      {}
    );
    expect(withMastery.shadowStepperVeryFarUnlocked).toBe(true);
  });
});

describe('loadCharacterFeatures — source scope keys', () => {
  it('assigns default classes:srd-cls-druid when class row has no sourceScopeKey', () => {
    const char = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const feats = loadCharacterFeatures(char, registry);
    const wildtouch = feats.find((f) => f.name === 'Wildtouch');
    expect(wildtouch?._sourceScopeKey).toBe(SRD_CLASS_DRUID_SCOPE_KEY);
    expect(resolveSourceScopeKey('classes', 'srd-cls-druid', registry.classes['srd-cls-druid'])).toBe(
      SRD_CLASS_DRUID_SCOPE_KEY
    );
  });

  it('assigns beastforms:<id> for beastform sub-features (applyDeclarativeFeatures virtualSources)', () => {
    const char = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      featureState: {
        Beastform: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const base = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(base, char, {}, registry);
    const fragile = decl.mergedFeatures.find((f) => f.name === 'Fragile');
    expect(fragile?._sourceScopeKey).toBe('beastforms:srd-bst-agile-scout');
  });
});

describe('applyDeclarativeFeatures — beastform virtualSources (married SRD + V2)', () => {
  it('injects married Agile Scout sub-features when featureState has active beastform', () => {
    const char = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      featureState: {
        Beastform: {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    });
    const base = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(base, char, {}, registry);
    const bf = decl.mergedFeatures.filter((f) => f._source === 'beastform');
    expect(bf.map((f) => f.name)).toEqual(['Agile', 'Fragile']);
    const fragile = bf.find((f) => f.name === 'Fragile');
    expect(fragile?.id).toBe('srd-bst-agile-scout-feat-fragile');
    expect(fragile?._beastformId).toBe('srd-bst-agile-scout');
    expect(fragile?._sourceObject?.id).toBe('srd-bst-agile-scout');
    expect(decl.virtualFeaturesExpanded.filter((f) => f._source === 'beastform').map((f) => f.name)).toEqual([
      'Agile',
      'Fragile',
    ]);
  });

  it('resolves active beastform from legacy character.activeBeastform.id', () => {
    const row = registry.beastforms['srd-bst-agile-scout'];
    const char = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      activeBeastform: { ...row },
    });
    const base = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(base, char, {}, registry);
    expect(decl.mergedFeatures.filter((f) => f._source === 'beastform').map((f) => f.name)).toEqual([
      'Agile',
      'Fragile',
    ]);
  });
});

describe('loadCharacterFeatures — items (inventory)', () => {
  it('appends V2 item features when inventory line id matches registry.items', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      inventory: [{ id: 'srd-itm-piper-whistle', name: 'Piper Whistle', quantity: 1 }],
    });
    const feats = loadCharacterFeatures(char, registry);
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Piper Whistle',
        _source: 'item',
        _ownerInstanceId: 'c1',
        _sourceObject: expect.objectContaining({
          name: 'Piper Whistle',
          description: expect.stringMatching(/1-mile|whistle/i),
        }),
      })
    );
  });

  it('ignores inventory lines without id or unknown item id', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      inventory: [{ name: 'Rope', quantity: 1 }, { id: 'srd-itm-not-in-registry', name: 'X' }],
    });
    const feats = loadCharacterFeatures(char, registry);
    expect(feats.filter((f) => f._source === 'item')).toEqual([]);
  });
});

describe('loadCharacterFeatures — ancestries (registry leaf rows)', () => {
  it('loads a V2 compound key row (e.g. Infernis.Fearless) as a feature row', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      ancestryIds: ['Infernis.Fearless'],
    });
    const feats = loadCharacterFeatures(char, registry);
    expect(feats.some((f) => f.name === 'Fearless')).toBe(true);
  });
});

describe('attachBeastformOptions', () => {
  it('adds _beastformOptions for Druid at tier 1 (only forms with tier ≤ 1)', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const c = attachBeastformOptions(raw, registry);
    expect(c._beastformOptions.length).toBeGreaterThan(0);
    expect(c._beastformOptions.every((b) => b.tier <= 1)).toBe(true);
  });

  it('returns the same reference for non-Druid', () => {
    const raw = mockCharacter({ instanceId: 'w1', classId: 'srd-cls-wizard' });
    const c = attachBeastformOptions(raw, registry);
    expect(c).toBe(raw);
  });

  it('includes tier-4 forms when character level maps to tier 4', () => {
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 8 });
    const c = attachBeastformOptions(raw, registry);
    const maxTier = Math.max(...c._beastformOptions.map((b) => b.tier));
    expect(maxTier).toBe(4);
  });
});
