import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { SplinteringStrike } from '../../../../src/features-v2/abilities/Bone/SplinteringStrike.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runResolve } from '../helpers.js';

describe('Bone — Splintering Strike', () => {
  it('card chip spends 1 Hope and sets splinteringStrikeActive', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { name: 'Longsword', damage: 'd8+1', range: 'Melee' },
    });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splintering Strike',
      featureState: { 'Splintering Strike': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplinteringStrike, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Splintering Strike' && c.placements?.includes('card'));
    expect(card).toBeDefined();
    expect(card.hopeCost).toBe(1);
    deductChipCosts(card, tbl);
    const fromUse = activateChip(card, tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Splintering Strike',
          key: 'splinteringStrikeActive',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Splintering Strike' }),
      })
    );
  });

  it('offers long-rest reviewAction chip when Splintering Strike is active and attack succeeds', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { name: 'Longsword', damage: 'd8+1', range: 'Melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splintering Strike',
      featureState: {
        'Splintering Strike': { splinteringStrikeActive: true },
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplinteringStrike, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const pooled = chips.find((c) => c.name === 'Splintering Strike — pooled damage');
    expect(pooled).toBeDefined();
    expect(pooled.frequency).toBe('longRest');
    expect(pooled.placements).toContain('reviewAction');
  });

  it('pooled damage chip adds an extra die matching primary weapon die size', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { name: 'Axe', damage: 'd10+2 phy', range: 'Melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splintering Strike',
      featureState: {
        'Splintering Strike': { splinteringStrikeActive: true },
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd10', value: 6 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplinteringStrike, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const pooled = chips.find((c) => c.name === 'Splintering Strike — pooled damage');
    deductChipCosts(pooled, tbl);
    const fromUse = activateChip(pooled, tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Splintering Strike (extra)',
          die: 'd10',
        }),
      })
    );
  });

  it('pooled damage chip adds one extra weapon die per successful target', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { name: 'Longsword', damage: 'd8+1', range: 'Melee' },
    });
    const adv1 = mockAdversary({ instanceId: 'adv-1' });
    const adv2 = mockAdversary({ instanceId: 'adv-2' });
    const adv3 = mockAdversary({ instanceId: 'adv-3' });
    const gs = mockGameState({
      activeElements: [char, adv1, adv2, adv3],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splintering Strike',
      featureState: {
        'Splintering Strike': { splinteringStrikeActive: true },
      },
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1', 'adv-2', 'adv-3'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplinteringStrike, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const pooled = chips.find((c) => c.name === 'Splintering Strike — pooled damage');
    deductChipCosts(pooled, tbl);
    const fromUse = activateChip(pooled, tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    const extras = m.filter(
      (x) =>
        x.type === 'addRollDie' &&
        String(x.payload?.name ?? '').startsWith('Splintering Strike (extra')
    );
    expect(extras).toHaveLength(3);
    expect(extras.map((x) => x.payload.die)).toEqual(['d8', 'd8', 'd8']);
  });

  it('onResolve clears splinteringStrikeActive', () => {
    const { mutations } = runResolve(
      { ...SplinteringStrike, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Splintering Strike': { splinteringStrikeActive: true },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'splinteringStrikeActive',
          value: false,
        }),
      })
    );
  });

  it('onResolve does not clear splinteringStrikeActive when resolving a non-attack action', () => {
    const { mutations } = runResolve(
      { ...SplinteringStrike, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Splintering Strike': { splinteringStrikeActive: true },
        },
        actionType: 'trait',
        action: {
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
        },
      }
    );
    expect(
      mutations.filter(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.key === 'splinteringStrikeActive' &&
          m.payload?.value === false
      )
    ).toHaveLength(0);
  });

  it('does not offer pooled chip without splinteringStrikeActive', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Splintering Strike',
      featureState: { 'Splintering Strike': {} },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...SplinteringStrike, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Splintering Strike — pooled damage')).toHaveLength(0);
  });
});
