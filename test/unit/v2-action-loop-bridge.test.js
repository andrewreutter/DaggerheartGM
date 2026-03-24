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
  getISeeItComingDefenseBonus,
  buildISeeItComingAckCleanupUpdates,
  I_SEE_IT_COMING_FEATURE_KEY,
} from '../../src/client/lib/v2-action-loop-bridge.js';

describe('v2-action-loop-bridge', () => {
  it('getISeeItComingDefenseBonus prefers legacy per-roll map then featureState', () => {
    const rid = 42;
    expect(
      getISeeItComingDefenseBonus(
        { _iSeeItComingRollBonus: { [rid]: 3 }, featureState: { [I_SEE_IT_COMING_FEATURE_KEY]: { iSeeItComingEvasionBonus: 2 } } },
        rid
      )
    ).toBe(3);
    expect(
      getISeeItComingDefenseBonus(
        { featureState: { [I_SEE_IT_COMING_FEATURE_KEY]: { iSeeItComingEvasionBonus: 4 } } },
        rid
      )
    ).toBe(4);
    expect(getISeeItComingDefenseBonus({ featureState: {} }, rid)).toBe(0);
  });

  it('buildISeeItComingAckCleanupUpdates clears legacy map and zeros V2 bonus for selected target', () => {
    const rid = 7;
    const el = {
      elementType: 'character',
      instanceId: 'pc1',
      _iSeeItComingRollBonus: { [rid]: 2, 99: 1 },
      featureState: { [I_SEE_IT_COMING_FEATURE_KEY]: { iSeeItComingEvasionBonus: 3 } },
    };
    const u = buildISeeItComingAckCleanupUpdates(el, rid, 'pc1');
    expect(u._iSeeItComingRollBonus[rid]).toBeUndefined();
    expect(u._iSeeItComingRollBonus[99]).toBe(1);
    expect(u.featureState[I_SEE_IT_COMING_FEATURE_KEY].iSeeItComingEvasionBonus).toBe(0);
    expect(buildISeeItComingAckCleanupUpdates(el, rid, 'other')).not.toHaveProperty('featureState');
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
