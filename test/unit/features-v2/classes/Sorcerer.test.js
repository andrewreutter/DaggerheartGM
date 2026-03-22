import { describe, it, expect } from 'vitest';
import {
  ArcaneSense,
  MinorIllusion,
  VolatileMagic,
  ChannelRawPower,
} from '../../../../src/features-v2/classes/Sorcerer.js';
import {
  collectChips,
  makeChipState,
  activateChip,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  mockGameState,
  mockRoll,
  mockCharacter,
  mockAdversary,
  mockAction,
  runReviewAction,
} from '../helpers.js';

describe('Sorcerer — Arcane Sense', () => {
  it('is narrative-only (name + description)', () => {
    expect(ArcaneSense.hooks).toBeUndefined();
    expect(ArcaneSense.chips).toBeUndefined();
    expect(ArcaneSense.name).toBe('Arcane Sense');
  });
});

describe('Sorcerer — Minor Illusion', () => {
  it('default card use queues an action loop with difficulty 10', () => {
    const table = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Minor Illusion',
      })
    );
    const annotated = { ...MinorIllusion, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotated], 'card', table);
    expect(chips).toHaveLength(1);

    chips[0].onUse(table, makeChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Minor Illusion',
          difficulty: 10,
        }),
      })
    );
  });
});

describe('Sorcerer — Volatile Magic', () => {
  function tableForVolatile(opts) {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const damageType = opts.damageType ?? 'magic';
    return buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        _ownerInstanceId: 'char-1',
        _featureKey: 'Volatile Magic',
        featureState: { 'Volatile Magic': {} },
        rolls: mockRoll({
          damageDice: [
            { name: 'blast', die: 'd8', value: 2 },
            { name: 'spark', die: 'd6', value: 4 },
          ],
        }),
        action: {
          ...mockAction({
            type: 'attack',
            actorInstanceId: 'char-1',
            targetInstanceIds: ['adv-1'],
          }),
          effects: [
            {
              type: 'damage',
              amount: 6,
              damageType,
              target: { instanceId: 'adv-1' },
            },
          ],
        },
      })
    );
  }

  it('exposes a reviewAction chip when the attack has magic damage and a damage pool', () => {
    const table = tableForVolatile({});
    const chips = collectChips([{ ...VolatileMagic, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(3);
  });

  it('onUse queues rerollDie for each damage die', () => {
    const table = tableForVolatile({});
    const chips = collectChips([{ ...VolatileMagic, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    chips[0].onUse(table, makeChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          dieType: 'damageDie',
          dieName: 'blast',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          dieType: 'damageDie',
          dieName: 'spark',
        }),
      })
    );
  });

  it('does not offer the chip when pending damage to the target is physical', () => {
    const table = tableForVolatile({ damageType: 'physical' });
    const chips = collectChips([{ ...VolatileMagic, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips).toHaveLength(0);
  });

  it('does not offer the chip on a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        _ownerInstanceId: 'char-1',
        _featureKey: 'Volatile Magic',
        rolls: mockRoll({
          damageDice: [{ name: 'blast', die: 'd8', value: 2 }],
        }),
        action: {
          ...mockAction({
            type: 'trait',
            actorInstanceId: 'char-1',
            targetInstanceIds: ['adv-1'],
          }),
          effects: [
            {
              type: 'damage',
              amount: 4,
              damageType: 'magic',
              target: { instanceId: 'adv-1' },
            },
          ],
        },
      })
    );
    const chips = collectChips([{ ...VolatileMagic, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips).toHaveLength(0);
  });
});

describe('Sorcerer — Channel Raw Power', () => {
  const annotated = { ...ChannelRawPower, _ownerInstanceId: 'char-1' };

  it('exposes a select chip on the card when the character has domain cards in loadout', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'd1', name: 'Ember', level: 2 }],
    });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Channel Raw Power',
        featureState: { 'Channel Raw Power': {} },
      })
    );
    const chips = collectChips([annotated], 'card', table);
    expect(chips).toHaveLength(1);
    expect(typeof chips[0].isSelect).toBe('function');
    const options = chips[0].isSelect(table);
    expect(options.some((o) => o.id === 'd1|hope')).toBe(true);
    expect(options.some((o) => o.id === 'd1|spell')).toBe(true);
  });

  it('disables the card when domain loadout is empty', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: [] });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Channel Raw Power',
      })
    );
    const chips = collectChips([annotated], 'card', table);
    expect(chips[0].disabled).toBe(true);
  });

  it('Hope path: moveDomainCardToVault + gainHope for card level', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'd1', name: 'Ember', level: 2 }],
    });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Channel Raw Power',
        featureState: { 'Channel Raw Power': {} },
      })
    );
    const chips = collectChips([annotated], 'card', table);
    const mutations = activateChip(chips[0], table, makeChipState(), { selectedId: 'd1|hope' });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: { instanceId: 'char-1', cardId: 'd1' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
  });

  it('Spell path: stores 2×level damage bonus for the next qualifying magic attack', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'd1', name: 'Ember', level: 3 }],
    });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Channel Raw Power',
        featureState: { 'Channel Raw Power': {} },
      })
    );
    const chips = collectChips([annotated], 'card', table);
    const mutations = activateChip(chips[0], table, makeChipState(), { selectedId: 'd1|spell' });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Channel Raw Power',
          key: 'channelRawPowerDamageBonus',
          value: 6,
        }),
      })
    );
  });

  it('onReviewAction adds stored bonus to magic spell damage then clears it', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewAction(annotated, {
      activeElements: [char, adv],
      featureState: {
        'Channel Raw Power': { channelRawPowerDamageBonus: 4 },
      },
      rolls: mockRoll({}),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [
          {
            type: 'damage',
            amount: 3,
            damageType: 'magic',
            target: { instanceId: 'adv-1' },
          },
        ],
        appliedEffects: [],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Channel Raw Power',
          value: 4,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'channelRawPowerDamageBonus',
          value: 0,
        }),
      })
    );
  });
});
