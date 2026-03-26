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
  v2BannerChipActivationKey,
  annotateV2ReviewChipsBannerConsumed,
  migrateV2BannerConsumedOnUseKeys,
  recordV2BannerConsumedOnUse,
  pruneV2BannerConsumedOnUseKeys,
  sumPendingEvasionBonusFromFeatureState,
  buildPendingEvasionBonusAckCleanupUpdates,
  buildV2DamageCommitEffects,
  readV2DamageCommitHpLossFromEffects,
  runV2DamageApplyReviewOutcomePhase,
  buildV2PreRollWeaponAttackRollSkeleton,
  buildV2PreRollTraitRollSkeleton,
  buildActionConfigFromRoll,
  collectV2WeaponIntentChips,
} from '../../src/client/lib/v2-action-loop-bridge.js';
import { PENDING_EVASION_BONUS_STATE_KEY } from '../../src/game-constants.js';

describe('v2-action-loop-bridge', () => {
  it('buildV2PreRollWeaponAttackRollSkeleton uses weapon damage notation for placeholder damage sub-item', () => {
    const sk = buildV2PreRollWeaponAttackRollSkeleton({
      pendingMeta: {
        _attackerInstanceId: 'pc1',
        _weaponId: 'w1',
        _traitKey: 'agility',
        _weaponRangeFt: 5,
      },
      pendingRollText: 'roll',
      characterEl: {
        instanceId: 'pc1',
        weapons: [{ id: 'w1', name: 'Blade', damage: '2d6', trait: 'agility' }],
      },
    });
    const dmg = sk.subItems.find((s) => /damage/i.test(s.pre));
    expect(dmg.input).toBe('2d6');
  });

  it('collectV2WeaponIntentChips returns empty when weapon intent scope is missing', () => {
    expect(
      collectV2WeaponIntentChips({
        pendingMeta: { _intentPanelForActionRoll: true },
        pendingRollText: 'x',
        characterEl: { instanceId: 'a' },
        activeElements: [],
        srdData: { ancestriesById: {} },
      })
    ).toEqual([]);
  });

  it('buildActionConfigFromRoll uses attack vs trait from weapon meta', () => {
    const els = [];
    expect(
      buildActionConfigFromRoll(
        { _attackerInstanceId: 'a', _traitKey: 'presence' },
        els
      ).type
    ).toBe('trait');
    expect(
      buildActionConfigFromRoll(
        { _attackerInstanceId: 'a', _traitKey: 'agility', _weaponRangeFt: 5 },
        els
      ).type
    ).toBe('attack');
  });

  it('buildV2PreRollTraitRollSkeleton includes trait sub-item without damage', () => {
    const sk = buildV2PreRollTraitRollSkeleton({
      pendingMeta: { _attackerInstanceId: 'pc1', _traitKey: 'presence' },
      pendingRollText: 'roll',
      characterEl: { instanceId: 'pc1', traits: { presence: 3 } },
    });
    expect(sk.subItems).toHaveLength(3);
    expect(sk.subItems[2].pre.trim()).toBe('Presence');
    expect(sk.subItems[2].input).toBe('3');
  });

  it('sumPendingEvasionBonusFromFeatureState sums pending evasion across featureState bags', () => {
    expect(
      sumPendingEvasionBonusFromFeatureState({
        featureState: {
          A: { [PENDING_EVASION_BONUS_STATE_KEY]: 2 },
          B: { [PENDING_EVASION_BONUS_STATE_KEY]: 1 },
        },
      })
    ).toBe(3);
    expect(sumPendingEvasionBonusFromFeatureState({ featureState: {} })).toBe(0);
  });

  it('buildPendingEvasionBonusAckCleanupUpdates zeros pending bonus for selected character only', () => {
    const el = {
      elementType: 'character',
      instanceId: 'pc1',
      featureState: { Scope: { [PENDING_EVASION_BONUS_STATE_KEY]: 3, other: 1 } },
    };
    const u = buildPendingEvasionBonusAckCleanupUpdates(el, 'pc1');
    expect(u.featureState.Scope[PENDING_EVASION_BONUS_STATE_KEY]).toBe(0);
    expect(u.featureState.Scope.other).toBe(1);
    expect(buildPendingEvasionBonusAckCleanupUpdates(el, 'other')).toBe(null);
  });

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

  it('buildV2DamageCommitEffects mirrors banner damage line + final HP loss for damage commit', () => {
    const roll = {
      subItems: [{ pre: 'damage ', input: 'd8', result: '9', post: ' phy' }],
      _useArmorByTargetId: { victim: true },
    };
    const eff = buildV2DamageCommitEffects({
      roll,
      targetInstanceId: 'victim',
      damageAmount: 9,
      hpLossAmount: 3,
    });
    expect(eff[0]).toMatchObject({ type: 'damage', amount: 9, damageType: 'physical', useArmor: true });
    expect(eff[1]).toMatchObject({ stat: 'currentHP', amount: 3 });
  });

  it('readV2DamageCommitHpLossFromEffects reads currentHP line for target id', () => {
    const effects = [
      { type: 'damage', target: { instanceId: 't1' }, amount: 5 },
      { stat: 'currentHP', target: { instanceId: 't1' }, amount: 2 },
    ];
    expect(readV2DamageCommitHpLossFromEffects(effects, 't1')).toBe(2);
    expect(readV2DamageCommitHpLossFromEffects(effects, 'other')).toBeUndefined();
  });

  it('runV2DamageApplyReviewOutcomePhase clears Elemental Incarnation channel on severe HP loss to Warden', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const warden = mockCharacter({
      instanceId: 'warden-pc',
      classId: 'srd-cls-druid',
      subclassId: 'srd-sub-warden-of-the-elements',
      level: 1,
      evasion: 8,
      armorThresholds: { major: 3, severe: 6 },
      featureState: { WardenOfTheElements: { channeledElement: 'fire', auraActive: false } },
    });
    const goblin = mockAdversary({ instanceId: 'goblin', difficulty: 10, tokenX: 0, tokenY: 0 });
    warden.tokenX = 0;
    warden.tokenY = 0;
    const roll = {
      _attackerInstanceId: 'goblin',
      _selectedTargetInstanceId: 'warden-pc',
      subItems: [{ pre: 'damage ', input: 'd8', result: '10', post: ' phy' }],
      total: 15,
      dominant: null,
    };
    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };
    enrichV2RollIsSuccessFromTarget(roll, [warden, goblin], srdData);
    expect(roll.isSuccess).toBe(true);

    const { elementUpdates, adjustedHpLoss } = runV2DamageApplyReviewOutcomePhase({
      roll,
      targetElement: warden,
      activeElements: [warden, goblin],
      srdData,
      damageAmount: 10,
      hpLossAmount: 3,
    });

    const wardenPatch = elementUpdates.find((u) => u.instanceId === 'warden-pc');
    expect(wardenPatch).toBeDefined();
    expect(wardenPatch.updates.featureState.WardenOfTheElements.channeledElement).toBeNull();
    expect(wardenPatch.updates.featureState.WardenOfTheElements.auraActive).toBe(false);
    expect(adjustedHpLoss).toBe(3);
  });

  it('runV2DamageApplyReviewOutcomePhase applies Elemental Dominion Earth d6 reduction to adjustedHpLoss', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const warden = mockCharacter({
      instanceId: 'warden-pc',
      classId: 'srd-cls-druid',
      subclassId: 'srd-sub-warden-of-the-elements',
      level: 1,
      tier: 4,
      evasion: 8,
      armorThresholds: { major: 3, severe: 6 },
      featureState: { WardenOfTheElements: { channeledElement: 'earth', auraActive: false } },
    });
    const goblin = mockAdversary({ instanceId: 'goblin', difficulty: 10, tokenX: 0, tokenY: 0 });
    warden.tokenX = 0;
    warden.tokenY = 0;
    const roll = {
      _attackerInstanceId: 'goblin',
      _selectedTargetInstanceId: 'warden-pc',
      subItems: [{ pre: 'damage ', input: 'd8', result: '3', post: ' phy' }],
      total: 15,
      dominant: null,
    };
    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };
    enrichV2RollIsSuccessFromTarget(roll, [warden, goblin], srdData);

    const outHigh = runV2DamageApplyReviewOutcomePhase({
      roll,
      targetElement: warden,
      activeElements: [warden, goblin],
      srdData,
      damageAmount: 3,
      hpLossAmount: 1,
      rng: () => 0.999,
    });
    expect(outHigh.adjustedHpLoss).toBe(0);

    const outLow = runV2DamageApplyReviewOutcomePhase({
      roll,
      targetElement: warden,
      activeElements: [warden, goblin],
      srdData,
      damageAmount: 3,
      hpLossAmount: 1,
      rng: () => 0.01,
    });
    expect(outLow.adjustedHpLoss).toBe(1);
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

  it('enrichV2RollIsSuccessFromTarget uses effectiveEvasion for character targets (matches GMTableView)', () => {
    const roll = { total: 12, _selectedTargetInstanceId: 'c1' };
    const activeElements = [
      {
        instanceId: 'c1',
        elementType: 'character',
        evasion: 10,
        activeModifiers: [{ type: 'evasion', value: 5 }],
      },
    ];
    enrichV2RollIsSuccessFromTarget(roll, activeElements);
    expect(roll.isSuccess).toBe(false);
  });

  it('collectV2ReviewActionChips includes Sneak Attack for Cloaked Rogue on a successful attack', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const rogue = mockCharacter({
      instanceId: 'rogue-1',
      classId: 'srd-cls-rogue',
      level: 5,
      conditions: ['Cloaked'],
    });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'rogue-1',
      _selectedTargetInstanceId: 'adv-1',
      _traitKey: 'agility',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [rogue, adv]);
    expect(roll.isSuccess).toBe(true);

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [rogue, adv],
      srdData: {
        weaponsById: {},
        armorById: {},
        ancestriesById: {},
        communitiesById: {},
        classesById: {},
        subclassesById: {},
      },
      dedupeFeatureNames: new Set(),
    });
    expect(chips.some((c) => c._featureName === 'Sneak Attack' && c.name === 'Sneak Attack')).toBe(true);
  });

  describe('viewer: player primary', () => {
  it('collectV2ReviewActionChips viewer: gm and owner player see Sneak Attack; other player does not', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const rogue = mockCharacter({
      instanceId: 'rogue-1',
      classId: 'srd-cls-rogue',
      level: 5,
      conditions: ['Cloaked'],
    });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'rogue-1',
      _selectedTargetInstanceId: 'adv-1',
      _traitKey: 'agility',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [rogue, adv]);
    expect(roll.isSuccess).toBe(true);

    const base = {
      roll,
      activeElements: [rogue, adv],
      srdData: {
        weaponsById: {},
        armorById: {},
        ancestriesById: {},
        communitiesById: {},
        classesById: {},
        subclassesById: {},
      },
      dedupeFeatureNames: new Set(),
    };

    const hasSneak = (chips) =>
      chips.some((c) => c._featureName === 'Sneak Attack' && c.name === 'Sneak Attack');

    expect(hasSneak(collectV2ReviewActionChips({ ...base, viewer: { role: 'gm' } }))).toBe(true);
    expect(hasSneak(collectV2ReviewActionChips({ ...base, viewer: { role: 'player', viewerCharacterInstanceId: 'rogue-1' } }))).toBe(
      true
    );
    expect(
      hasSneak(
        collectV2ReviewActionChips({
          ...base,
          viewer: { role: 'player', viewerCharacterInstanceId: 'spectator-pc' },
        })
      )
    ).toBe(false);
  });

  it('collectV2ReviewActionChips viewer: Fearless only for GM, owner player, or legacy (no viewer); not for other player', async () => {
    const { mockCharacter } = await import('./features-v2/helpers.js');
    const char = mockCharacter({
      instanceId: 'char-1',
      ancestryIds: ['Infernis.Fearless', 'Infernis.DreadVisage'],
    });
    const other = mockCharacter({ instanceId: 'other-pc', classId: 'srd-cls-rogue' });
    const roll = {
      _attackerInstanceId: 'char-1',
      _traitKey: 'agility',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '8', post: '' },
        { pre: 'Fear ', input: 'd12', result: '3', post: '' },
      ],
      dominant: 'hope',
      total: 11,
    };

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };

    const base = {
      roll,
      activeElements: [char, other],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
    };

    const hasFearless = (chips) => chips.some((c) => c._featureName === 'Fearless');

    expect(hasFearless(collectV2ReviewActionChips(base))).toBe(true);
    expect(hasFearless(collectV2ReviewActionChips({ ...base, viewer: { role: 'gm' } }))).toBe(true);
    expect(hasFearless(collectV2ReviewActionChips({ ...base, viewer: { role: 'player', viewerCharacterInstanceId: 'char-1' } }))).toBe(
      true
    );
    expect(
      hasFearless(
        collectV2ReviewActionChips({ ...base, viewer: { role: 'player', viewerCharacterInstanceId: 'other-pc' } })
      )
    ).toBe(false);
  });
  });

  it('collectV2ReviewActionChips includes Fearless on duality trait roll without damage (Infernis)', async () => {
    const { mockCharacter } = await import('./features-v2/helpers.js');
    const char = mockCharacter({
      instanceId: 'char-1',
      ancestryIds: ['Infernis.Fearless', 'Infernis.DreadVisage'],
    });
    const roll = {
      _attackerInstanceId: 'char-1',
      _traitKey: 'agility',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '8', post: '' },
        { pre: 'Fear ', input: 'd12', result: '3', post: '' },
      ],
      dominant: 'hope',
      total: 11,
    };

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [char],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
    });
    expect(chips.some((c) => c._featureName === 'Fearless')).toBe(true);
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
    });
    const rw = chips.find((c) => c._featureName === 'Rune Ward' && c.name === 'Rune Ward');
    expect(rw).toBeDefined();
    expect(rw.showOnOtherSheets).toBe(true);
    expect(rw._crossSheetViewerInstanceId).toBe('ally-1');

    const { mutations } = activateV2ReviewChip(rw, roll, [wizard, ally, adv], srdData, {});
    expect(mutations.some((m) => m.type === 'spendHope' && m.payload?.instanceId === 'ally-1')).toBe(true);
  });

  it('collectV2ReviewActionChips legacy: Rally spend chip for bard actor when target is only an adversary (actor in cross-sheet set)', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const bard = mockCharacter({
      instanceId: 'bard-1',
      classId: 'srd-cls-bard',
      level: 3,
      featureState: {
        Rally: {
          partyDice: { 'bard-1': { dice: 'd6' } },
        },
      },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'bard-1',
      _selectedTargetInstanceId: 'adv-1',
      _traitKey: 'presence',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [bard, adv]);

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [bard, adv],
      srdData: {
        weaponsById: {},
        armorById: {},
        ancestriesById: {},
        communitiesById: {},
        classesById: {},
        subclassesById: {},
      },
      dedupeFeatureNames: new Set(),
    });
    const rallyDamage = chips.find(
      (c) =>
        c._featureName === 'Rally' &&
        typeof c.name === 'string' &&
        c.name.includes('Spend Rally Die') &&
        c.name.includes('Damage')
    );
    expect(rallyDamage).toBeDefined();
    expect(rallyDamage.showOnOtherSheets).toBe(true);
  });

  it('collectV2ReviewActionChips player viewer: non-Bard attacker gets Rally spend from cross-sheet merge', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const bard = mockCharacter({
      instanceId: 'bard-1',
      classId: 'srd-cls-bard',
      level: 3,
      featureState: {
        Rally: {
          partyDice: { 'fighter-1': { dice: 'd6' } },
        },
      },
    });
    const fighter = mockCharacter({ instanceId: 'fighter-1', classId: 'srd-cls-warrior', level: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'fighter-1',
      _selectedTargetInstanceId: 'adv-1',
      _traitKey: 'strength',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [bard, fighter, adv]);

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [bard, fighter, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
      viewer: { role: 'player', viewerCharacterInstanceId: 'fighter-1' },
    });
    const rallyDamage = chips.find(
      (c) =>
        c._featureName === 'Rally' &&
        typeof c.name === 'string' &&
        c.name.includes('Spend Rally Die') &&
        c.name.includes('Damage')
    );
    expect(rallyDamage).toBeDefined();
    expect(rallyDamage.showOnOtherSheets).toBe(true);

    const activated = activateV2ReviewChip(rallyDamage, roll, [bard, fighter, adv], srdData, {});
    expect(activated.error).toBeFalsy();
    expect(activated.mutations?.length).toBeGreaterThan(0);
  });

  it('collectV2ReviewActionChips player viewer: preview-as-Bard still sees Rally on ally attack (viewer + actor union)', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const bard = mockCharacter({
      instanceId: 'bard-1',
      classId: 'srd-cls-bard',
      level: 3,
      featureState: {
        Rally: {
          partyDice: { 'fighter-1': { dice: 'd6' } },
        },
      },
    });
    const fighter = mockCharacter({ instanceId: 'fighter-1', classId: 'srd-cls-warrior', level: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const roll = {
      _attackerInstanceId: 'fighter-1',
      _selectedTargetInstanceId: 'adv-1',
      _traitKey: 'strength',
      subItems: [
        { pre: 'Hope ', input: 'd12', result: '9', post: '' },
        { pre: 'Fear ', input: 'd12', result: '4', post: '' },
        { pre: 'damage ', input: 'd8', result: '5', post: ' phy' },
      ],
      total: 18,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [bard, fighter, adv]);

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
      subclassesById: {},
    };

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [bard, fighter, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
      viewer: { role: 'player', viewerCharacterInstanceId: 'bard-1' },
    });
    const rallyDamage = chips.find(
      (c) =>
        c._featureName === 'Rally' &&
        typeof c.name === 'string' &&
        c.name.includes('Spend Rally Die') &&
        c.name.includes('Damage')
    );
    expect(rallyDamage).toBeDefined();
  });

  it('resolveV2ReviewChipPicker returns null when arguments are incomplete', () => {
    expect(resolveV2ReviewChipPicker({}, {}, [], {})).toBe(null);
    expect(buildV2ReviewChipTableSnapshot({}, {}, [], {})).toBe(null);
  });

  describe('one-shot onUse review chips', () => {
    it('annotateV2ReviewChipsBannerConsumed marks Sneak Attack consumed after record', () => {
      const chip = {
        _featureName: 'Sneak Attack',
        name: 'Sneak Attack',
        _ownerInstanceId: 'rogue-1',
        _chipKey: 'Sneak Attack::Sneak Attack::reviewAction',
        onUse: () => {},
      };
      const key = v2BannerChipActivationKey(chip);
      expect(key).toContain('rogue-1');
      expect(key).toContain('Sneak Attack');
      let map = new Map();
      map = recordV2BannerConsumedOnUse(42, chip, map);
      const consumed = map.get(42);
      const annotated = annotateV2ReviewChipsBannerConsumed([chip], consumed);
      expect(annotated).toHaveLength(1);
      expect(annotated[0]._v2BannerOnUseConsumed).toBe(true);
    });

    it('does not mark toggle chips as consumed', () => {
      const chip = {
        _featureName: 'Test',
        name: 'T',
        _ownerInstanceId: 'c1',
        _chipKey: 'Test::T::card',
        isToggle: true,
        onUse: () => {},
      };
      let map = new Map();
      map = recordV2BannerConsumedOnUse(1, chip, map);
      const annotated = annotateV2ReviewChipsBannerConsumed([chip], map.get(1));
      expect(annotated[0]._v2BannerOnUseConsumed).toBeUndefined();
    });

    it('migrateV2BannerConsumedOnUseKeys merges keys into replacement roll id', () => {
      const chip = {
        _featureName: 'Sneak Attack',
        name: 'Sneak Attack',
        _ownerInstanceId: 'r1',
        _chipKey: 'Sneak Attack::Sneak Attack::reviewAction',
        onUse: () => {},
      };
      let map = new Map();
      map = recordV2BannerConsumedOnUse(100, chip, map);
      map = migrateV2BannerConsumedOnUseKeys(100, 101, map);
      expect(map.get(100)).toBeUndefined();
      expect(map.get(101)?.has(v2BannerChipActivationKey(chip))).toBe(true);
    });

    it('pruneV2BannerConsumedOnUseKeys drops stale roll ids', () => {
      const chip = {
        _featureName: 'X',
        name: 'X',
        _ownerInstanceId: 'a',
        _chipKey: 'X::X::reviewAction',
        onUse: () => {},
      };
      let map = new Map();
      map = recordV2BannerConsumedOnUse(5, chip, map);
      const pruned = pruneV2BannerConsumedOnUseKeys(map, [10]);
      expect(pruned.size).toBe(0);
    });
  });
});
