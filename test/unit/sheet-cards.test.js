import { describe, it, expect } from 'vitest';
import {
  collectSheetCards,
  collectEditorCards,
  collectChipsForShapePlacement,
  shapePlacementMatches,
  buildCardsForFeature,
  normalizeCardEntry,
  activateChip,
  makeChipState,
} from '../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../src/features-v2/engine/table.js';
import { Companion, srdifyRangerCompanion } from '../../src/features-v2/subclasses/Beastbound.js';
import { buildEditorTableStub, buildGuideFeatureTableSnapshot } from '../../src/client/lib/build-feature-card-model.js';
import { wrapJsonSchemaFragment, mapDhSchemaTypesForValidator } from '../../src/client/lib/json-schema-dh.js';
import Ajv from 'ajv';

function minimalTableForCharacter(el) {
  const gameState = {
    fear: 0,
    mapConfig: null,
    activeElements: [el],
    featureState: {},
    action: {
      type: 'free',
      actorInstanceId: el.instanceId,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
    _ownerInstanceId: el.instanceId,
    registry: {},
  };
  return buildTableSnapshot(gameState);
}

describe('normalizeCardEntry', () => {
  it('wraps legacy bare objects as sheet placement', () => {
    expect(normalizeCardEntry({ ping: 1 })).toEqual({
      placement: 'sheet',
      shape: null,
      resolve: { ping: 1 },
    });
  });
});

describe('buildCardsForFeature', () => {
  it('returns normalized card entries', () => {
    const f = { name: 'X', cards: [{ _sheetCardKind: 'test' }] };
    expect(buildCardsForFeature(f)).toEqual([
      { placement: 'sheet', shape: null, resolve: { _sheetCardKind: 'test' } },
    ]);
  });

  it('returns empty array when no cards', () => {
    expect(buildCardsForFeature({ name: 'Y' })).toEqual([]);
  });
});

describe('collectSheetCards', () => {
  it('buildGuideFeatureTableSnapshot exposes me.companion when el has no id/instanceId (library preview)', () => {
    const el = {
      elementType: 'character',
      name: 'Ranger',
      traits: { presence: 2 },
      companion: {
        name: 'Artaq',
        species: 'Jhereg',
        evasion: 10,
        attackName: 'Stinger',
        maxStress: 3,
        currentStress: 0,
        experiences: [
          { name: 'A', score: 2 },
          { name: 'B', score: 2 },
        ],
      },
    };
    const table = buildGuideFeatureTableSnapshot(el, Companion, undefined);
    expect(table.me?.companion?.name).toBe('Artaq');
    const rows = collectSheetCards([Companion], table);
    expect(rows.length).toBe(1);
    expect(rows[0].shape?.id).toBe('dh.shape.rangerCompanion');
  });

  it('unwraps when() and resolves Beastbound companion card with shapeId', () => {
    const el = {
      instanceId: 'pc-1',
      elementType: 'character',
      name: 'Test',
      classId: 'srd-cls-ranger',
      subclassId: 'srd-sub-beastbound',
      traits: { presence: 2 },
      spellcastTrait: 'presence',
      companion: {
        name: 'Artaq',
        species: 'Jhereg',
        evasion: 10,
        attackName: 'Stinger',
        maxStress: 3,
        currentStress: 0,
        experiences: [{ name: 'Odd Clues', score: 2 }],
      },
    };
    const table = minimalTableForCharacter(el);
    const rows = collectSheetCards([Companion], table);
    expect(rows.length).toBe(1);
    expect(rows[0].shape?.id).toBe('dh.shape.rangerCompanion');
    expect(rows[0].card.shapeId).toBe('dh.shape.rangerCompanion');
    expect(rows[0].card.name).toBe('Artaq');
    expect(srdifyRangerCompanion(null)).toBeNull();
  });

  it('returns empty when no companion payload', () => {
    const el = {
      instanceId: 'pc-3',
      elementType: 'character',
      name: 'Test',
      classId: 'srd-cls-ranger',
      subclassId: 'srd-sub-beastbound',
    };
    const table = minimalTableForCharacter(el);
    const rows = collectSheetCards([Companion], table);
    expect(rows.length).toBe(0);
  });

  it('collectChipsForShapePlacement matches chips whose placements include the shape object', () => {
    const el = {
      instanceId: 'pc-1',
      elementType: 'character',
      name: 'Ranger',
      classId: 'srd-cls-ranger',
      subclassId: 'srd-sub-beastbound',
      traits: { presence: 2 },
      spellcastTrait: 'presence',
      companion: {
        name: 'Artaq',
        species: 'Jhereg',
        evasion: 10,
        attackName: 'Stinger',
        maxStress: 3,
        currentStress: 0,
        experiences: [
          { name: 'A', score: 2 },
          { name: 'B', score: 2 },
        ],
      },
    };
    const table = minimalTableForCharacter(el);
    const shape = Companion.cards[0].shape;
    const chips = collectChipsForShapePlacement([Companion], shape, table, {});
    expect(chips.length).toBe(1);
    expect(chips[0].name).toBe('Take an action');
    const mutations = activateChip(chips[0], table, makeChipState());
    const rollM = mutations.find((m) => m.type === 'sheetActionRoll');
    expect(rollM?.payload?.rollText).toContain('Companion Act');
    expect(rollM?.payload?.rollMeta?._companionExperienceForRoll).toBe(true);
  });

  it('collectChipsForShapePlacement matches by shape.id when object references differ (merged activeFeatures)', () => {
    const el = {
      instanceId: 'pc-1',
      elementType: 'character',
      name: 'Ranger',
      classId: 'srd-cls-ranger',
      subclassId: 'srd-sub-beastbound',
      traits: { presence: 2 },
      spellcastTrait: 'presence',
      companion: {
        name: 'Artaq',
        species: 'Jhereg',
        evasion: 10,
        attackName: 'Stinger',
        maxStress: 3,
        currentStress: 0,
        experiences: [
          { name: 'A', score: 2 },
          { name: 'B', score: 2 },
        ],
      },
    };
    const table = minimalTableForCharacter(el);
    const shapeClone = { ...Companion.cards[0].shape };
    expect(shapeClone).not.toBe(Companion.cards[0].shape);
    expect(shapePlacementMatches(shapeClone, Companion.chips[0].placements[0])).toBe(true);
    const chips = collectChipsForShapePlacement([Companion], shapeClone, table, {});
    expect(chips.length).toBe(1);
    expect(chips[0].name).toBe('Take an action');
  });
});

describe('collectEditorCards', () => {
  it('resolves editor placement with stub table', () => {
    const stub = buildEditorTableStub({ companion: { name: 'X', species: 'Y', attackName: 'Z', experiences: [] } });
    const rows = collectEditorCards([Companion], stub);
    expect(rows.length).toBe(1);
    expect(rows[0].shape?.id).toBe('dh.shape.rangerCompanion');
    expect(rows[0].card).toEqual({});
  });
});

describe('companion JSON Schema (bootstrap + Ajv)', () => {
  it('validates a good companion payload after DH type mapping', () => {
    const raw = Companion.cards[0].shape.jsonSchema;
    const wrapped = wrapJsonSchemaFragment(mapDhSchemaTypesForValidator(raw));
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(wrapped);
    const ok = {
      name: 'A',
      species: 'B',
      attackName: 'Bite',
      evasion: 10,
      maxStress: 3,
      currentStress: 0,
      experiences: [
        { id: '1', name: 'E1', score: 2 },
        { id: '2', name: 'E2', score: 2 },
      ],
    };
    expect(validate(ok)).toBe(true);
  });
});
