import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { LeadByExample } from '../../../../src/features-v2/abilities/Valor/LeadByExample.js';
import { mockAdversary, mockCharacter, mockGameState, mockRoll } from '../helpers.js';

const feature = (ownerId) => ({ ...LeadByExample, _ownerInstanceId: ownerId });

describe('Valor — Lead by Example', () => {
  it('reviewAction: spending Stress flags the damaged adversary for an ally follow-up', () => {
    const leader = mockCharacter({ instanceId: 'leader', currentStress: 1 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const fs = { 'Lead by Example': {} };
    const gs = mockGameState({
      activeElements: [leader, adv],
      _ownerInstanceId: 'leader',
      _featureKey: 'Lead by Example',
      featureState: fs,
      action: {
        type: 'attack',
        actorInstanceId: 'leader',
        targetInstanceIds: ['adv-1'],
        effects: [{ type: 'damage', target: adv, amount: 2 }],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feature('leader')], 'reviewAction', tbl);
    const enc = chips.find((c) => c.name === 'Lead by Example — encourage allies');
    expect(enc).toBeDefined();
    expect(enc.stressCost).toBe(1);
    const fromUse = activateChip(enc, tbl, makeChipState());
    deductChipCosts(enc, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'leader', amount: 1 }),
      })
    );
    expect(fs['Lead by Example']?.markedAdversaryId).toBe('adv-1');
    expect(fs['Lead by Example']?.grantorInstanceId).toBe('leader');
  });

  it('reviewAction: ally attacking marked foe can clear Stress via cross-sheet chip', () => {
    const leader = mockCharacter({ instanceId: 'leader' });
    const ally = mockCharacter({ instanceId: 'ally', currentStress: 2, hope: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const fs = {
      'Lead by Example': { markedAdversaryId: 'adv-1', grantorInstanceId: 'leader' },
    };
    const gs = mockGameState({
      activeElements: [leader, ally, adv],
      _ownerInstanceId: 'ally',
      _featureKey: 'Lead by Example',
      featureState: fs,
      action: {
        type: 'attack',
        actorInstanceId: 'ally',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feature('leader')], 'reviewAction', tbl);
    const inspired = chips.find((c) => c.name === 'Lead by Example — inspired strike');
    expect(inspired?.showOnOtherSheets).toBe(true);
    const fromUse = activateChip(inspired, tbl, makeChipState(), { selectedId: 'stress' });
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'ally', amount: 1 }),
      })
    );
    expect(fs['Lead by Example']?.markedAdversaryId).toBeNull();
  });

  it('does not show ally chip to the grantor on their own attack', () => {
    const leader = mockCharacter({ instanceId: 'leader', currentStress: 1 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const fs = {
      'Lead by Example': { markedAdversaryId: 'adv-1', grantorInstanceId: 'leader' },
    };
    const gs = mockGameState({
      activeElements: [leader, adv],
      _ownerInstanceId: 'leader',
      _featureKey: 'Lead by Example',
      featureState: fs,
      action: {
        type: 'attack',
        actorInstanceId: 'leader',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feature('leader')], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Lead by Example — inspired strike')).toHaveLength(0);
  });
});
