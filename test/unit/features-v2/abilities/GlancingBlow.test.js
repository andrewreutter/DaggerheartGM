import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { GlancingBlow } from '../../../../src/features-v2/abilities/Blade/GlancingBlow.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction } from '../helpers.js';

const sword = {
  id: 'w1',
  name: 'Longsword',
  damage: 'd8',
  tier: 1,
  trait: 'strength',
  range: 'melee',
  features: [],
};

describe('Blade — Glancing Blow', () => {
  it('shows reviewAction chip when your attack fails', () => {
    const { chips } = runReviewAction(
      { ...GlancingBlow, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            proficiency: 3,
            primaryWeapon: sword,
            weapons: [sword],
          }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          weaponId: 'w1',
        },
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    const gb = chips.find((c) => c.name === 'Glancing Blow');
    expect(gb).toBeDefined();
    expect(gb.placements).toContain('reviewAction');
    expect(gb.stressCost).toBe(1);
  });

  it('does not show the chip when the attack succeeds', () => {
    const { chips } = runReviewAction(
      { ...GlancingBlow, _ownerInstanceId: 'c1' },
      {
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          weaponId: 'w1',
        },
        rolls: mockRoll({ isSuccess: true }),
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            proficiency: 3,
            primaryWeapon: sword,
            weapons: [sword],
          }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
      }
    );
    expect(chips.filter((c) => c.name === 'Glancing Blow')).toHaveLength(0);
  });

  it('onUse queues addDamageRoll with weapon dice plus half Proficiency (rounded down)', () => {
    const self = mockCharacter({
      instanceId: 'c1',
      proficiency: 3,
      primaryWeapon: sword,
      weapons: [sword],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips: phaseChips } = runReviewAction(
      { ...GlancingBlow, _ownerInstanceId: 'c1' },
      {
        activeElements: [self, adv],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          weaponId: 'w1',
        },
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    const gb = phaseChips.find((c) => c.name === 'Glancing Blow');
    expect(gb).toBeDefined();

    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Glancing Blow',
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w1',
      },
      rolls: mockRoll({ isSuccess: false }),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(gb, tbl, makeChipState());
    deductChipCosts(gb, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Glancing Blow',
          dice: 'd8+1',
          targetInstanceIds: ['adv-1'],
          damageType: 'physical',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('uses d6 when no weapon damage is available', () => {
    const self = mockCharacter({
      instanceId: 'c1',
      proficiency: 2,
      weapons: [],
      primaryWeapon: null,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Glancing Blow',
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: mockRoll({ isSuccess: false }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GlancingBlow, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const gb = chips.find((c) => c.name === 'Glancing Blow');
    const fromUse = activateChip(gb, tbl, makeChipState());
    deductChipCosts(gb, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          dice: 'd6+1',
          targetInstanceIds: ['adv-1'],
        }),
      })
    );
  });
});
