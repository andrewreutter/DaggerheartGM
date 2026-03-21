import { describe, it, expect } from 'vitest';
import { Massive } from '../../../../src/features-v2/weapon_properties/Massive.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Massive', () => {
  it('has passiveStatMods evasion: -1', () => {
    expect(Massive.passiveStatMods.evasion).toBe(-1);
  });

  it('applies -1 evasion via declarative features', () => {
    const char = mockCharacter({ instanceId: 'char-1', evasion: 10 });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'char-1' }));
    const { stats } = applyDeclarativeFeatures(
      [{ ...Massive, _ownerInstanceId: 'char-1' }],
      char,
      table
    );
    expect(stats.evasion).toBe(9);
  });

  it('adds advantage die to damage roll on an attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Massive, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: { rollKey: 'damage', name: 'Massive' },
      })
    );
  });

  it('does not add advantage die when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Massive, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });

  it('does not add advantage die on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });

    const { mutations } = runIntent(Massive, {
      activeElements: [char],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });
});
