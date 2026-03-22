import { describe, it, expect } from 'vitest';
import {
  hydrateV2RollsFromClientRoll,
  engineRangeBandFromDistanceFt,
  buildActionConfigFromRoll,
  collectV2ReviewActionChips,
  activateV2ReviewChip,
  enrichV2RollIsSuccessFromTarget,
  V2_REVIEW_ACTION_PHASE1_DEDUPE,
  postTagToEngineDamageType,
  buildV2SyntheticActionEffects,
  resolveV2ReviewChipPicker,
  buildV2ReviewChipTableSnapshot,
} from '../../src/client/lib/v2-action-loop-bridge.js';

describe('v2-action-loop-bridge', () => {
  it('hydrateV2RollsFromClientRoll maps Hope/Fear and damage sub-items', () => {
    const roll = {
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '8', post: '' },
        { pre: 'Fear ', input: 'd12', result: '3', post: '' },
        { pre: 'damage ', input: 'd8', result: '4', post: ' phy' },
      ],
      dominant: 'hope',
    };
    const r = hydrateV2RollsFromClientRoll(roll);
    expect(r.action.hopeDie.value).toBe(8);
    expect(r.action.fearDie.value).toBe(3);
    expect(r.damage.dice[0].die).toBe('d8');
    expect(r.damage.dice[0].value).toBe(4);
    expect(r.damage.dice[0].damageType).toBe('physical');
    expect(r.damage.damageType).toBe('physical');
  });

  it('postTagToEngineDamageType maps phy/mag', () => {
    expect(postTagToEngineDamageType('phy')).toBe('physical');
    expect(postTagToEngineDamageType('mag')).toBe('magic');
    expect(postTagToEngineDamageType('')).toBe(null);
  });

  it('buildV2SyntheticActionEffects adds damage + currentHP effects for the selected target', () => {
    const target = {
      instanceId: 'char-t',
      elementType: 'character',
      level: 1,
      armorThresholds: { major: 3, severe: 6 },
    };
    const roll = {
      _selectedTargetInstanceId: 'char-t',
      subItems: [{ pre: 'damage ', input: 'd8', result: '3', post: ' phy' }],
      _useArmorByTargetId: { 'char-t': true },
    };
    const effects = buildV2SyntheticActionEffects(roll, [target]);
    const dmg = effects.find((e) => e.type === 'damage');
    const hp = effects.find((e) => e.stat === 'currentHP');
    expect(dmg.damageType).toBe('physical');
    expect(dmg.amount).toBe(3);
    expect(dmg.useArmor).toBe(true);
    // effectiveThresholds major = 3 + level 1 = 4 → raw 3 is Minor → 1 HP
    expect(hp.amount).toBe(1);
  });

  it('engineRangeBandFromDistanceFt matches engine bands', () => {
    expect(engineRangeBandFromDistanceFt(4)).toBe('melee');
    expect(engineRangeBandFromDistanceFt(25)).toBe('close');
  });

  it('buildActionConfigFromRoll sets attack + weaponId from roll meta', () => {
    const activeElements = [
      {
        instanceId: 'c1',
        elementType: 'character',
        tokenX: 0,
        tokenY: 0,
        weapons: [{ id: 'w1', name: 'Bow', damage: 'd8', trait: 'Agility', range: 'Close' }],
      },
      { instanceId: 'a1', elementType: 'adversary', tokenX: 20, tokenY: 0, difficulty: 12 },
    ];
    const roll = {
      _attackerInstanceId: 'c1',
      _selectedTargetInstanceId: 'a1',
      _weaponId: 'w1',
      _traitKey: 'agility',
      _weaponRangeFt: 30,
    };
    const cfg = buildActionConfigFromRoll(roll, activeElements);
    expect(cfg.type).toBe('attack');
    expect(cfg.weaponId).toBe('w1');
    expect(cfg.targetInstanceIds).toEqual(['a1']);
    expect(cfg.traitKey).toBe('Agility');
  });

  it('enrichV2RollIsSuccessFromTarget sets isSuccess vs adversary difficulty', () => {
    const roll = { total: 15, _selectedTargetInstanceId: 'a1' };
    const activeElements = [
      { instanceId: 'a1', elementType: 'adversary', difficulty: 14 },
    ];
    enrichV2RollIsSuccessFromTarget(roll, activeElements);
    expect(roll.isSuccess).toBe(true);
  });

  it('collectV2ReviewActionChips includes Hold Them Off by default; explicit dedupe set can still filter', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const char = mockCharacter({
      instanceId: 'char-1',
      classId: 'srd-cls-ranger',
      primaryWeaponId: 'w1',
      tokenX: 0,
      tokenY: 0,
      weapons: [{ id: 'w1', name: 'Shortbow', damage: 'd8', trait: 'Agility', range: 'close' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0, difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'char-1',
      _selectedTargetInstanceId: 'adv-1',
      _weaponId: 'w1',
      _traitKey: 'agility',
      _weaponRangeFt: 30,
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [char, adv]);

    const srdData = {
      weaponsById: { w1: char.weapons[0] },
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
      armorById: {},
    };

    const defaultDedupe = collectV2ReviewActionChips({
      roll,
      activeElements: [char, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      force: true,
    });
    expect(defaultDedupe.some((c) => c._featureName === 'Hold Them Off')).toBe(true);
    expect(V2_REVIEW_ACTION_PHASE1_DEDUPE.size).toBe(0);

    const explicitDedupe = collectV2ReviewActionChips({
      roll,
      activeElements: [char, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(['Hold Them Off']),
      force: true,
    });
    expect(explicitDedupe.some((c) => c._featureName === 'Hold Them Off')).toBe(false);
  });

  it('collectV2ReviewActionChips includes cross-sheet Rune Ward for the holder when an ally holds the ward', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const wizard = mockCharacter({
      instanceId: 'wiz-1',
      abilityIds: ['srd-abl-rune-ward'],
      featureState: { 'Rune Ward': { runeWardHolderInstanceId: 'ally-1' } },
    });
    const ally = mockCharacter({ instanceId: 'ally-1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const roll = {
      _attackerInstanceId: 'adv-1',
      _selectedTargetInstanceId: 'ally-1',
      _traitKey: 'agility',
      subItems: [{ pre: 'damage ', input: 'd8', result: '3', post: ' phy' }],
      total: 10,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [wizard, ally, adv]);

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
    };

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [wizard, ally, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
      force: true,
    });
    const rw = chips.find((c) => c._featureName === 'Rune Ward' && c.name === 'Rune Ward');
    expect(rw).toBeDefined();
    expect(rw.showOnOtherSheets).toBe(true);
    expect(rw._crossSheetViewerInstanceId).toBe('ally-1');

    const { mutations } = activateV2ReviewChip(rw, roll, [wizard, ally, adv], srdData, {});
    expect(mutations.some((m) => m.type === 'spendHope' && m.payload?.instanceId === 'ally-1')).toBe(true);
  });

  it('resolveV2ReviewChipPicker returns null when arguments are incomplete', () => {
    expect(resolveV2ReviewChipPicker({}, {}, [], {})).toBe(null);
    expect(buildV2ReviewChipTableSnapshot({}, {}, [], {})).toBe(null);
  });
});
