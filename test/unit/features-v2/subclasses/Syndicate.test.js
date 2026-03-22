import { describe, it, expect } from 'vitest';
import {
  WellConnected,
  ContactsEverywhere,
  ReliableBackup,
} from '../../../../src/features-v2/subclasses/Syndicate.js';
import { collectChips, activateChip, deductChipCosts, trackChipFrequency } from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { mockGameState, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';

describe('Syndicate — Well-Connected', () => {
  it('is narrative-only (CONV-027)', () => {
    expect(WellConnected.chips).toBeUndefined();
    expect(WellConnected.hooks).toBeUndefined();
    expect(WellConnected.name).toBe('Well-Connected');
  });
});

describe('Syndicate — Reliable Backup', () => {
  it('declares contactsEverywhereSessionUses for declarative merge', () => {
    expect(ReliableBackup.contactsEverywhereSessionUses).toBe(3);
    const char = mockCharacter({ instanceId: 'c1' });
    const { contactsEverywhereSessionUses } = applyDeclarativeFeatures(
      [
        { ...ContactsEverywhere, _ownerInstanceId: 'c1' },
        { ...ReliableBackup, _ownerInstanceId: 'c1' },
      ],
      char,
      {}
    );
    expect(contactsEverywhereSessionUses).toBe(3);
  });
});

describe('Syndicate — Contacts Everywhere', () => {
  it('exposes a session card with isSelect and posts actionLoop for gold option', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Contacts Everywhere',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('session');

    const st = mockChipState();
    st.set('selectedId', 'gold');
    const fromUse = activateChip(chips[0], table, st);
    deductChipCosts(chips[0], table);
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Contacts Everywhere',
        }),
      })
    );
  });

  it('offers 5 isSelect options when contactsEverywhereSessionUses is 3', () => {
    const char = mockCharacter({ instanceId: 'char-1', contactsEverywhereSessionUses: 3 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Contacts Everywhere',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const chips = collectChips([{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }], 'card', table);
    const raw = chips[0].isSelect;
    const opts = typeof raw === 'function' ? raw(table) : raw;
    expect(opts.length).toBe(5);
    expect(opts.map((o) => o.id)).toContain('hpShield');
    expect(opts.map((o) => o.id)).toContain('presenceD20');
  });

  it('allows three session uses when frequencyMaxUses resolves to 3', () => {
    const char = mockCharacter({ instanceId: 'char-1', contactsEverywhereSessionUses: 3 });
    const table = buildTableSnapshot(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' })
    );
    const chips = collectChips([{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }], 'card', table);
    const max = chips[0].frequencyMaxUses(table);
    expect(max).toBe(3);
    const chipKey = 'Contacts Everywhere::Contacts Everywhere::card';
    const usageStore = {};
    expect(trackChipFrequency(chipKey, 'session', usageStore, max)).toBe(true);
    expect(trackChipFrequency(chipKey, 'session', usageStore, max)).toBe(true);
    expect(trackChipFrequency(chipKey, 'session', usageStore, max)).toBe(true);
    expect(trackChipFrequency(chipKey, 'session', usageStore, max)).toBe(false);
    const still = collectChips([{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }], 'card', table, usageStore);
    expect(still).toHaveLength(0);
  });

  it('onReviewAction reduces pending damage when hpShield flag is set', () => {
    const char = mockCharacter({ instanceId: 'char-1', contactsEverywhereSessionUses: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 2, damageType: 'physical' },
    ];
    const gameState = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: { 'Contacts Everywhere': { pendingHpShield: true } },
    });
    const loop = createActionLoop(
      gameState,
      { type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['char-1'] },
      [{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }]
    );
    loop.setEffects(effects);
    const r = loop.runPhase('reviewAction');
    expect(effects[0].amount).toBe(1);
    expect(r.mutations.some((m) => m.type === 'setFeatureState' && m.payload.key === 'pendingHpShield')).toBe(
      true
    );
  });

  it('onIntent sets d20 Hope die when conversationHopeD20 flag is set', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gameState = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      featureState: { 'Contacts Everywhere': { conversationHopeD20: true } },
      rolls: {
        action: {
          hopeDie: { die: 'd12', value: 5 },
          fearDie: { die: 'd12', value: 3 },
        },
      },
    });
    const loop = createActionLoop(
      gameState,
      { type: 'trait', actorInstanceId: 'char-1', traitKey: 'presence' },
      [{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }]
    );
    const r = loop.runPhase('intent');
    expect(
      r.mutations.some(
        (m) => m.type === 'setDie' && m.payload.dieType === 'hopeDie' && m.payload.die === 'd20'
      )
    ).toBe(true);
  });

  it('does not fire actionLoop when no option is selected', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Contacts Everywhere',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...ContactsEverywhere, _ownerInstanceId: 'char-1' }], 'card', table);
    const st = mockChipState();
    st.set('selectedId', '');
    const fromUse = activateChip(chips[0], table, st);
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations.filter((m) => m.type === 'actionLoop')).toHaveLength(0);
  });
});
