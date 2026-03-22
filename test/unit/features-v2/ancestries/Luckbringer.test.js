import { describe, it, expect } from 'vitest';
import { runResolve, mockCharacter } from '../helpers.js';
import { Luckbringer } from '../../../../src/features-v2/ancestries/Halfling.js';

describe('Luckbringer', () => {
  it('has onSessionStart hook', () => {
    expect(Luckbringer.hooks).toBeDefined();
    expect(Luckbringer.hooks.onSessionStart).toBeDefined();
    expect(typeof Luckbringer.hooks.onSessionStart).toBe('function');
  });

  it('grants Hope to all party members on session start', () => {
    const char1 = mockCharacter({ instanceId: 'char-1', name: 'Alice' });
    const char2 = mockCharacter({ instanceId: 'char-2', name: 'Bob' });
    const char3 = mockCharacter({ instanceId: 'char-3', name: 'Charlie' });

    const result = runResolve(Luckbringer, {
      activeElements: [char1, char2, char3],
      _ownerInstanceId: 'char-1',
      actionType: 'sessionStart',
      action: {
        type: 'sessionStart',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });

    // Check for gainHope mutations for all characters
    const hopeMutations = result.mutations.filter(
      (m) => m.type === 'gainHope' && m.payload.amount === 1
    );
    // Should grant Hope to all 3 characters
    expect(hopeMutations.length).toBe(3);
    expect(hopeMutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(hopeMutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-2', amount: 1 }),
      })
    );
    expect(hopeMutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-3', amount: 1 }),
      })
    );
  });
});
