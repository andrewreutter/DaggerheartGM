import { describe, it, expect } from 'vitest';
import { RetractingClaws } from '../../../../src/features-v2/ancestries/Katari.js';
import { runResolve, mockTable, mockCharacter, mockAdversary } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Retracting Claws', () => {
  it('has a virtual weapon with Agility trait and melee range', () => {
    const table = mockTable();
    const resolved = unwrapAll(RetractingClaws.virtualWeapons, table);
    
    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe('Retracting Claws');
    expect(resolved[0].trait).toBe('agility');
    expect(resolved[0].range).toBe('melee');
    expect(resolved[0].damage).toBeUndefined();
  });

  it('applies Vulnerable condition on successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    
    // Test the virtual weapon's hook directly
    const table = mockTable({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    const virtualWeapon = unwrapAll(RetractingClaws.virtualWeapons, table)[0];
    expect(virtualWeapon.hooks).toBeDefined();
    expect(virtualWeapon.hooks.onResolve).toBeDefined();
    
    const hook = unwrapAll(virtualWeapon.hooks.onResolve, table);
    expect(typeof hook).toBe('function');
    
    hook(table);
    const mutations = applyMutations(table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'adv-1', condition: 'Vulnerable' }
      })
    );
  });

  it('does not apply Vulnerable on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    
    const table = mockTable({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 2 },
          dice: [],
          statics: [],
          isSuccess: false,
        },
      },
    });

    const virtualWeapon = unwrapAll(RetractingClaws.virtualWeapons, table)[0];
    const hook = unwrapAll(virtualWeapon.hooks.onResolve, table);
    
    // Hook should not resolve when isSuccess is false (when() condition fails)
    if (typeof hook === 'function') {
      hook(table);
      const mutations = applyMutations(table);
      
      const vulnerableMutations = mutations.filter(
        m => m.type === 'addCondition' && m.payload.condition === 'Vulnerable'
      );
      expect(vulnerableMutations).toHaveLength(0);
    } else {
      // Hook didn't resolve, which is correct - it should only fire on success
      expect(hook).toBeUndefined();
    }
  });

  it('does not apply Vulnerable when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    
    const table = mockTable({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-2', // Different owner
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    const virtualWeapon = unwrapAll(RetractingClaws.virtualWeapons, table)[0];
    const hook = unwrapAll(virtualWeapon.hooks.onResolve, table);
    
    // Hook should not resolve when not acting (when() condition fails)
    expect(hook).toBeUndefined();
  });
});
