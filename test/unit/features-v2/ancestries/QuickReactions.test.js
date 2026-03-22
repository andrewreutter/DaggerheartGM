import { describe, it, expect } from 'vitest';
import { runIntent, mockTable } from '../helpers.js';
import { QuickReactions } from '../../../../src/features-v2/ancestries/Elf.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Quick Reactions', () => {
  it('shows chip during intent phase when acting on a reaction roll', () => {
    const result = runIntent(QuickReactions, {
      action: {
        type: 'reaction',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: null },
          fearDie: { value: null },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].name).toBe('Quick Reactions');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].isToggle).toBe(true);
    expect(result.chips[0].placements).toContain('intent');
  });

  it('does not show chip when not acting', () => {
    const result = runIntent(QuickReactions, {
      action: {
        type: 'reaction',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: null },
          fearDie: { value: null },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip on non-reaction rolls', () => {
    const result = runIntent(QuickReactions, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: null },
          fearDie: { value: null },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('chip has correct properties for adding advantage die when toggled on', () => {
    const result = runIntent(QuickReactions, {
      action: {
        type: 'reaction',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: null },
          fearDie: { value: null },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable();
    chip.onUse(table, { isOn: true });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: { rollKey: 'action', name: 'Quick Reactions' }
      })
    );
  });

  it('chip has correct properties for removing advantage die when toggled off', () => {
    const result = runIntent(QuickReactions, {
      action: {
        type: 'reaction',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: null },
          fearDie: { value: null },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable();
    chip.onUse(table, { isOn: false });
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeRollDie',
        payload: { rollKey: 'action', name: 'Quick Reactions' }
      })
    );
  });
});
