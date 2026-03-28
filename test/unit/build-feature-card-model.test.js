import { describe, it, expect } from 'vitest';
import {
  buildFeatureCardModel,
  collectActionLoopPhaseFlags,
  flattenChipsForDisplay,
  collectPassiveBonusTooltipLines,
  resolveFeatureDisplayName,
  resolveGuideSourceLabel,
  resolveGuideSourceType,
  hasHiddenConditionalPhaseChips,
  V2_TABLE_STUB_NO_INSTANCE_ID,
  collectV2IsToggleCardFeatureGroups,
} from '../../src/client/lib/build-feature-card-model.js';
import { resolveChipDisabled } from '../../src/features-v2/engine/chip-system.js';
import { ElementalIncarnation } from '../../src/features-v2/subclasses/WardenOfTheElements.js';
import { RangersFocus } from '../../src/features-v2/classes/Ranger.js';
import { Beastform } from '../../src/features-v2/classes/Druid.js';
import { CaprineLeap } from '../../src/features-v2/ancestries/Faun.js';
import { Retract } from '../../src/features-v2/ancestries/Galapa.js';
import { PrayerDice } from '../../src/features-v2/classes/Seraph.js';
import { buildTableSnapshot } from '../../src/features-v2/engine/table.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../src/features-v2/engine/feature-scope-keys.js';
import registry from '../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, mockRoll } from './features-v2/helpers.js';

describe('flattenChipsForDisplay', () => {
  it('unwraps when() wrappers to leaf chips', async () => {
    const { when, isActing } = await import('../../src/features-v2/engine/when.js');
    const wrapped = [
      when(isActing, {
        name: 'X',
        placements: ['card'],
        hopeCost: 1,
      }),
    ];
    const flat = flattenChipsForDisplay(wrapped);
    expect(flat).toHaveLength(1);
    expect(flat[0].hopeCost).toBe(1);
  });
});

describe('collectPassiveBonusTooltipLines', () => {
  it('includes static passiveStatMods for header tooltip', () => {
    const lines = collectPassiveBonusTooltipLines({
      passiveStatMods: { evasion: 1, majorThreshold: 2 },
    });
    expect(lines.some((b) => b.includes('Evasion'))).toBe(true);
    expect(lines.some((b) => b.includes('Major'))).toBe(true);
  });

  it('includes damage affinities', () => {
    const lines = collectPassiveBonusTooltipLines({
      damageAffinities: {
        resistances: ['fire'],
        immunities: ['cold'],
        vulnerabilities: ['radiant'],
      },
    });
    expect(lines).toEqual([
      'Resist: fire',
      'Immune: cold',
      'Vulnerable: radiant',
    ]);
  });

  it('does not add advantageTriggers (description is enough)', () => {
    const lines = collectPassiveBonusTooltipLines({
      advantageTriggers: ['rolls to intimidate hostile creatures'],
    });
    expect(lines.some((b) => b.startsWith('Advantage:'))).toBe(false);
  });
});

describe('V2_TABLE_STUB_NO_INSTANCE_ID', () => {
  it('supports chip isDisabled predicates that use table.characters', () => {
    const chip = {
      isDisabled: (table) => table.characters.filter(() => true).length === 0,
    };
    expect(() => resolveChipDisabled(chip, V2_TABLE_STUB_NO_INSTANCE_ID)).not.toThrow();
    expect(resolveChipDisabled(chip, V2_TABLE_STUB_NO_INSTANCE_ID)).toBe(true);
  });
});

describe('collectActionLoopPhaseFlags', () => {
  it('sets reviewAction when a chip includes that placement', () => {
    const row = {
      name: 'T',
      description: 'd',
      chips: [{ name: 'X', placements: ['card', 'reviewAction'] }],
    };
    const f = collectActionLoopPhaseFlags(row);
    expect(f.reviewAction).toBe(true);
    expect(f.intent).toBe(false);
    expect(f.reviewOutcome).toBe(false);
  });

  it('sets intent when hooks.onIntent is present', () => {
    const row = {
      name: 'T',
      description: 'd',
      hopeCost: 1,
      onUse() {},
      hooks: { onIntent: () => {} },
    };
    const f = collectActionLoopPhaseFlags(row);
    expect(f.intent).toBe(true);
  });

  it('sets intent from passive advantageTriggers', () => {
    const row = {
      name: 'Lightfoot',
      description: 'd',
      advantageTriggers: ['rolls to move without being heard'],
    };
    expect(collectActionLoopPhaseFlags(row).intent).toBe(true);
  });

  it('sets intent when advantageTriggers are when()-wrapped', async () => {
    const { when, isActing } = await import('../../src/features-v2/engine/when.js');
    const row = {
      name: 'T',
      description: 'd',
      advantageTriggers: [when(isActing, 'rolls while acting')],
    };
    expect(collectActionLoopPhaseFlags(row).intent).toBe(true);
  });

  it('is attached to buildFeatureCardModel as actionLoopPhases', () => {
    const row = {
      name: 'T',
      description: 'd',
      chips: [{ name: 'X', placements: ['card', 'reviewOutcome'] }],
    };
    const m = buildFeatureCardModel(row);
    expect(m.actionLoopPhases.reviewOutcome).toBe(true);
    expect(m.actionLoopPhases.intent).toBe(false);
  });
});

describe('hasHiddenConditionalPhaseChips', () => {
  it('is true when a when()-wrapped contextual chip does not unwrap for the current table', async () => {
    const { when, isActing } = await import('../../src/features-v2/engine/when.js');
    const row = {
      name: 'T',
      description: 'd',
      chips: [
        when(isActing, {
          name: 'X',
          placements: ['reviewAction'],
        }),
      ],
    };
    expect(hasHiddenConditionalPhaseChips(row, { me: { isActing: false } }, 'pc1')).toBe(true);
    expect(hasHiddenConditionalPhaseChips(row, { me: { isActing: true } }, 'pc1')).toBe(false);
  });

  it('is false for plain chips (no when)', () => {
    const row = {
      name: 'T',
      description: 'd',
      chips: [{ name: 'X', placements: ['reviewAction'] }],
    };
    expect(hasHiddenConditionalPhaseChips(row, { me: {} }, 'pc1')).toBe(false);
  });

  it('matches Prayer Dice: hidden without pool or with pool but no eligible roll', () => {
    const row = { ...PrayerDice, type: 'class', name: PrayerDice.name, description: PrayerDice.description };
    const tableEmptyPool = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [mockCharacter({ instanceId: 's1', prayerDice: { pool: [] } })],
        _ownerInstanceId: 's1',
        _featureKey: 'Prayer Dice',
        action: { type: 'free', actorInstanceId: 's1', targetInstanceIds: [], effects: [], appliedEffects: [] },
        rolls: {},
      }),
    );
    expect(hasHiddenConditionalPhaseChips(row, tableEmptyPool, 's1')).toBe(true);

    const tableWithPoolNoRoll = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [mockCharacter({ instanceId: 's1', prayerDice: { pool: [3, 4] } })],
        _ownerInstanceId: 's1',
        _featureKey: 'Prayer Dice',
        action: { type: 'free', actorInstanceId: 's1', targetInstanceIds: [], effects: [], appliedEffects: [] },
        rolls: {},
      }),
    );
    // Pool dice make the always-on "Prayer Die — gain Hope" `card` chip unwrap; reviewAction chips stay gated.
    expect(hasHiddenConditionalPhaseChips(row, tableWithPoolNoRoll, 's1')).toBe(false);

    const tableAidEligible = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [mockCharacter({ instanceId: 's1', prayerDice: { pool: [3, 4] } })],
        _ownerInstanceId: 's1',
        _featureKey: 'Prayer Dice',
        action: {
          type: 'attack',
          actorInstanceId: 's1',
          targetInstanceIds: ['adv-1'],
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      }),
    );
    expect(hasHiddenConditionalPhaseChips(row, tableAidEligible, 's1')).toBe(false);
  });
});

describe('buildFeatureCardModel', () => {
  it('collects card-phase chips from Warden Elemental Incarnation', () => {
    const row = {
      ...ElementalIncarnation,
      type: 'subclass',
      name: ElementalIncarnation.name,
      description: ElementalIncarnation.description,
    };
    const m = buildFeatureCardModel(row);
    expect(m.cardChips.length).toBeGreaterThanOrEqual(1);
    expect(m.cardChips[0].placements || m.cardChips[0].placement).toBeTruthy();
  });

  it("Ranger's Focus intent chips stay out of cardChips (card vs intent surfaces are separate)", () => {
    const row = {
      ...RangersFocus,
      type: 'class',
      name: RangersFocus.name,
      description: RangersFocus.description,
    };
    const raw = mockCharacter({ instanceId: 'r1' });
    const table = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [raw],
        _ownerInstanceId: 'r1',
        _featureKey: "Ranger's Focus",
        action: {
          type: 'free',
          actorInstanceId: 'r1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const m = buildFeatureCardModel(row, { table, ownerInstanceId: 'r1' });
    expect(m.cardChips.some((c) => c && c.isToggle)).toBe(false);
    expect(m.actionLoopPhases.intent).toBe(true);
  });

  it('matches engine collectChips when table + ownerInstanceId (Beastform card chips)', () => {
    const row = { ...Beastform, type: 'class', name: Beastform.name, description: Beastform.description };
    const raw = mockCharacter({ instanceId: 'd1', classId: 'srd-cls-druid', level: 1 });
    const tableOut = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [raw],
        _ownerInstanceId: 'd1',
        _featureKey: 'Beastform',
        featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
        action: {
          type: 'free',
          actorInstanceId: 'd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const mOut = buildFeatureCardModel(row, { table: tableOut, ownerInstanceId: 'd1' });
    expect(mOut.cardChips.map((c) => c.name)).toEqual(['Beastform']);

    const rawIn = mockCharacter({
      instanceId: 'd1',
      classId: 'srd-cls-druid',
      level: 1,
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    });
    const tableIn = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [rawIn],
        _ownerInstanceId: 'd1',
        _featureKey: 'Beastform',
        featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: {} },
        action: {
          type: 'free',
          actorInstanceId: 'd1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const mIn = buildFeatureCardModel(row, { table: tableIn, ownerInstanceId: 'd1' });
    expect(mIn.cardChips.map((c) => c.name)).toEqual(['Beastform', 'Drop out of Agile Scout Beastform']);
    expect(mOut.displayName).toBe('Beastform');
    expect(mIn.displayName).toBe('Beastform — Agile Scout');
  });

  it('marks Faun Caprine Leap as narrative-only (chip uses Share Feature Text path)', () => {
    const row = { ...CaprineLeap, type: 'ancestry' };
    const raw = mockCharacter({ instanceId: 'f1' });
    const table = buildTableSnapshot(
      mockGameState({
        registry,
        activeElements: [raw],
        _ownerInstanceId: 'f1',
        _featureKey: CaprineLeap.name,
        action: {
          type: 'free',
          actorInstanceId: 'f1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      }),
    );
    const m = buildFeatureCardModel(row, { table, ownerInstanceId: 'f1' });
    expect(m.isNarrativeOnlyCard).toBe(true);
    expect(m.cardChips[0]?.narrativeBannerOnly).toBe(true);
  });

  it('resolveFeatureDisplayName defaults to name and resolves optional string or function', () => {
    expect(resolveFeatureDisplayName({ name: 'X' }, null)).toBe('X');
    expect(resolveFeatureDisplayName({ name: 'X', displayName: 'Y' }, null)).toBe('Y');
    expect(
      resolveFeatureDisplayName(
        {
          name: 'X',
          displayName: (t) => (t?.me?.inBeastform ? 'In' : 'Out'),
        },
        { me: { inBeastform: true } },
      ),
    ).toBe('In');
  });

  it('domain ability source pill uses domain · type · level, not ability name', () => {
    const srd = {
      name: 'Bare Bones',
      domain: 'Valor',
      type: 'Passive',
      level: 1,
    };
    const m = buildFeatureCardModel({
      name: 'Bare Bones',
      type: 'ability',
      description: '…',
      source: srd,
    });
    expect(m.sourceLabel).toBe('Valor · Passive · Lvl 1');
    expect(m.sourceType).toBe('domain');
  });

  it('resolveGuideSourceLabel does not fall back to source.name for abilities', () => {
    expect(
      resolveGuideSourceLabel({
        name: 'X',
        type: 'ability',
        source: { name: 'X', domain: '', type: '', level: null },
      }),
    ).toBeUndefined();
  });

  it('resolveGuideSourceType preserves explicit sourceType on abilities', () => {
    expect(resolveGuideSourceType({ type: 'ability', sourceType: 'class' })).toBe('class');
  });

  it("treats sourceType 'ability' as domain for palette/badge (internal _source leak)", () => {
    expect(resolveGuideSourceType({ type: 'ability', sourceType: 'ability' })).toBe('domain');
  });
});

describe('collectV2IsToggleCardFeatureGroups', () => {
  it('returns merged feature rows that expose an isToggle card chip', () => {
    const row = {
      ...Retract,
      type: 'ancestry',
      name: Retract.name,
      description: Retract.description,
      _sourceScopeKey: 'ancestry:retract',
    };
    const el = {
      instanceId: 'pc1',
      elementType: 'character',
      activeFeatures: [row],
      featureUsage: {},
    };
    const ctx = {
      registry,
      activeElements: [el],
      fearCount: 0,
      mapConfig: null,
      tableFeatureState: {},
    };
    const groups = collectV2IsToggleCardFeatureGroups(el, ctx);
    expect(groups.length).toBe(1);
    expect(groups[0].model.cardChips.some((c) => c.isToggle)).toBe(true);
  });
});
