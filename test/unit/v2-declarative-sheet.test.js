import { describe, it, expect } from 'vitest';
import {
  expandSrdAncestryIdsToV2Keys,
  resolveSrdAncestryRowToV2Keys,
  mergeV2DeclarativeSheetOverlay,
  buildV2RegistryWithSrdItems,
} from '../../src/client/lib/v2-declarative-sheet.js';
import { recomputeCharacter } from '../../src/client/lib/character-calc.js';
import { parseBeastformBonus } from '../../src/client/lib/helpers.js';
import v2registry from '../../src/features-v2/registry.js';

describe('v2-declarative-sheet', () => {
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

  it('mergeV2DeclarativeSheetOverlay copies _sourceScopeKey onto class activeFeatures (View implementation source)', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-bard': {
          id: 'srd-cls-bard',
          name: 'Bard',
          hope_feature: { name: 'Rally', description: 'x' },
          domains: [],
          class_features: [{ name: 'Make a Scene', description: 'scene' }],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };

    const raw = {
      instanceId: 'pc1',
      classId: 'srd-cls-bard',
      level: 1,
      baseTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      weapons: [],
      proficiency: 1,
    };

    const base = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
    const mas = merged.activeFeatures.find((f) => f.name === 'Make a Scene');
    expect(mas?._sourceScopeKey).toBe('classes:srd-cls-bard');
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

  it('mergeV2DeclarativeSheetOverlay does not throw when the character has library id but no instanceId', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-bard': {
          id: 'srd-cls-bard',
          name: 'Bard',
          hope_feature: { name: 'Hope', description: 'x' },
          domains: [],
          class_features: [],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };

    const raw = {
      id: 'lib-char-abc',
      classId: 'srd-cls-bard',
      level: 1,
      baseTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      weapons: [],
      proficiency: 1,
    };

    const recomputed = { ...raw, tier: 1 };

    expect(() => mergeV2DeclarativeSheetOverlay(recomputed, raw, srdData, {})).not.toThrow();
  });

  it('mergeV2DeclarativeSheetOverlay keeps table activeModifiers from rawCharacter (not overwritten by recomputed)', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-rogue': {
          id: 'srd-cls-rogue',
          name: 'Rogue',
          hope_feature: { name: 'Hope', description: 'x' },
          domains: [],
          class_features: [],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };

    const tableMod = { id: 'rogues-dodge-evasion', type: 'evasion', value: 2, name: "Rogue's Dodge" };
    const raw = {
      instanceId: 'rogue-1',
      classId: 'srd-cls-rogue',
      level: 1,
      baseTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      weapons: [],
      proficiency: 1,
      activeModifiers: [tableMod],
    };

    const recomputed = {
      ...raw,
      tier: 1,
      activeModifiers: [],
    };

    const merged = mergeV2DeclarativeSheetOverlay(recomputed, raw, srdData, {});
    expect(merged.activeModifiers).toEqual([tableMod]);
  });

  it('mergeV2DeclarativeSheetOverlay appends V2 hope feature row (Evolution) onto activeFeatures', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-druid': {
          id: 'srd-cls-druid',
          name: 'Druid',
          hope_feature: { name: 'Evolution', description: 'Spend 3 Hope to transform…' },
          domains: [],
          class_features: [
            { name: 'Beastform', description: 'bf' },
            { name: 'Wildtouch', description: 'wt' },
          ],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };

    const raw = {
      instanceId: 'druid-1',
      classId: 'srd-cls-druid',
      level: 1,
      baseTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 1, knowledge: 0 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      weapons: [],
      proficiency: 1,
    };

    const recomputed = {
      ...raw,
      tier: 1,
      class: 'Druid',
      hopeFeature: { name: 'Evolution', description: 'Spend 3 Hope to transform…' },
      classFeatures: [
        { name: 'Beastform', description: 'bf' },
        { name: 'Wildtouch', description: 'wt' },
      ],
      activeFeatures: [
        { name: 'Beastform', type: 'class', source: 'Druid', description: 'bf' },
        { name: 'Wildtouch', type: 'class', source: 'Druid', description: 'wt' },
      ],
    };

    const merged = mergeV2DeclarativeSheetOverlay(recomputed, raw, srdData, {});
    const evo = merged.activeFeatures.find((f) => f.name === 'Evolution');
    expect(evo).toBeDefined();
    expect(Array.isArray(evo.chips)).toBe(true);
    expect(evo.type).toBe('class');
  });

  it('mergeV2DeclarativeSheetOverlay does not duplicate Katari Retracting Claws in weapons', () => {
    const srdData = {
      ancestriesById: {
        'srd-anc-katari': {
          id: 'srd-anc-katari',
          name: 'Katari',
          features: [
            { name: 'Feline Instincts', description: 'x' },
            { name: 'Retracting Claws', description: 'y' },
          ],
        },
      },
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-warrior': {
          id: 'srd-cls-warrior',
          name: 'Warrior',
          hope_feature: { name: 'Attack of Opportunity', description: 'x' },
          domains: [],
          class_features: [],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };

    const raw = {
      instanceId: 'kat-1',
      classId: 'srd-cls-warrior',
      ancestryIds: ['srd-anc-katari'],
      level: 1,
      baseTraits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      advancements: {},
    };

    const base = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
    const claws = merged.weapons.filter((w) => w.name === 'Retracting Claws');
    expect(claws).toHaveLength(1);
  });

  it('mergeV2DeclarativeSheetOverlay appends Beastform virtual weapon with damage, Physical, Melee, trait', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {
        'w-staff': {
          id: 'w-staff',
          name: 'Quarterstaff',
          trait: 'Instinct',
          range: 'Melee',
          damage: 'd10',
          physical_or_magical: 'Physical',
          features: [],
        },
      },
      armorById: {},
      classesById: {
        'srd-cls-druid': {
          id: 'srd-cls-druid',
          name: 'Druid',
          domains: [],
          class_features: [
            { name: 'Beastform', description: 'x' },
            { name: 'Wildtouch', description: 'y' },
          ],
        },
      },
      subclassesById: {},
      communitiesById: {},
      abilitiesById: {},
    };

    const raw = {
      instanceId: 'druid-bf',
      classId: 'srd-cls-druid',
      level: 1,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      primaryWeaponId: 'w-staff',
      secondaryWeaponId: null,
      armorId: null,
      ancestryIds: [],
      communityId: null,
      abilityIds: [],
      featureState: {
        'classes:srd-cls-druid': {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    };

    const base = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
    const bf = merged.weapons.find((w) => w.id === '__beastform_natural__');
    expect(bf).toBeDefined();
    expect(bf.name).toContain('Agile Scout');
    expect(bf.damage).toMatch(/d4\+/);
    expect(bf.damageType).toBe('Physical');
    expect(bf.range).toBe('Melee');
    expect(bf.trait).toBe('agility');
  });

  it('mergeV2DeclarativeSheetOverlay enriches activeBeastform with SRD trait/evasion bonus strings (featureState-only)', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-druid': {
          id: 'srd-cls-druid',
          name: 'Druid',
          domains: [],
          class_features: [
            { name: 'Beastform', description: 'x' },
            { name: 'Wildtouch', description: 'y' },
          ],
        },
      },
      subclassesById: {},
      communitiesById: {},
      abilitiesById: {},
    };

    const raw = {
      instanceId: 'druid-bf',
      classId: 'srd-cls-druid',
      level: 1,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      featureState: {
        'classes:srd-cls-druid': {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    };

    const base = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
    expect(merged.activeBeastform).toMatchObject({
      beastformId: 'srd-bst-agile-scout',
      trait_bonus: 'Agility +1',
      evasion_bonus: 'Evasion +2',
      attack: 'Melee Agility d4 phy',
      advantages: 'deceive, locate, sneak',
    });
    expect(merged.activeBeastform.name).toBe('Agile Scout');
  });

  it('merged activeBeastform trait_bonus yields same trait roll modifier as CharacterHoverCard (base + parseBeastformBonus)', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-druid': {
          id: 'srd-cls-druid',
          name: 'Druid',
          domains: [],
          class_features: [
            { name: 'Beastform', description: 'x' },
            { name: 'Wildtouch', description: 'y' },
          ],
        },
      },
      subclassesById: {},
      communitiesById: {},
      abilitiesById: {},
    };

    const raw = {
      instanceId: 'druid-bf',
      classId: 'srd-cls-druid',
      level: 1,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      featureState: {
        'classes:srd-cls-druid': {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    };

    const base = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(base, raw, srdData, {});
    expect(raw.featureState['classes:srd-cls-druid'].activeBeastform.trait_bonus).toBeUndefined();
    const traitKey = 'agility';
    const baseScore = merged.traits[traitKey] ?? 0;
    const bf = parseBeastformBonus(merged.activeBeastform?.trait_bonus);
    const effective = baseScore + (bf?.stat === traitKey ? bf.bonus : 0);
    expect(effective).toBe(3);
  });
});
