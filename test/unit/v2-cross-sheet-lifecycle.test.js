import { describe, it, expect } from 'vitest';
import { collectV2CrossSheetChips, runV2TokenMoveHooks } from '../../src/client/lib/v2-cross-sheet-lifecycle.js';
import { applyV2LifecycleMutations, applyTableOp } from '../../src/client/lib/table-ops.js';
import { buildV2RegistryWithSrdItems } from '../../src/client/lib/v2-declarative-sheet.js';
import { mockCharacter } from './features-v2/helpers.js';

describe('v2-cross-sheet-lifecycle', () => {
  const minimalSrd = {
    classes: [],
    subclasses: [],
    ancestries: [],
    communities: [],
    weapons: [],
    armor: [],
    abilities: [],
    domains: [],
    beastforms: [],
  };

  it('collectV2CrossSheetChips returns Spend Rally Die — Clear Stress when partyDice and modifier are set', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      classId: 'srd-cls-bard',
      level: 1,
    });
    const ally = mockCharacter({
      instanceId: 'a1',
      level: 1,
      activeModifiers: [{ id: 'rally-die-a1', name: 'Rally Die', dice: 'd6', type: 'rally', refreshOn: 'session' }],
    });
    const els = [bard, ally];
    const registry = buildV2RegistryWithSrdItems(minimalSrd);
    const merged = {
      Rally: {
        partyDice: { a1: { dice: 'd6' } },
      },
    };
    const chipsWithState = collectV2CrossSheetChips('a1', els, registry, 'card', {
      tableFeatureState: merged,
      fearCount: 0,
      mapConfig: null,
    });
    expect(chipsWithState.some((c) => c.name === 'Spend Rally Die — Clear Stress')).toBe(true);
  });

  it('runV2TokenMoveHooks returns mutations and narrations arrays', () => {
    const c = mockCharacter({ instanceId: 'r1', tokenX: 1, tokenY: 0 });
    const registry = buildV2RegistryWithSrdItems(minimalSrd);
    const out = runV2TokenMoveHooks(
      {
        moverInstanceId: 'r1',
        previousTokenFt: { tokenX: 0, tokenY: 0 },
        postMoveActiveElements: [c],
        tableFeatureState: {},
        fearCount: 0,
        mapConfig: null,
      },
      registry
    );
    expect(Array.isArray(out.mutations)).toBe(true);
    expect(Array.isArray(out.narrations)).toBe(true);
  });
});

describe('applyV2LifecycleMutations', () => {
  it('merges removeCondition with banner mutations', () => {
    const c1 = mockCharacter({ instanceId: 'c1', conditions: ['Cloaked'] });
    const c2 = mockCharacter({ instanceId: 'c2' });
    const els = [c1, c2];
    const mutations = [
      { type: 'removeCondition', payload: { instanceId: 'c1', condition: 'Cloaked' } },
      {
        type: 'setFeatureState',
        payload: { featureKey: 'Rally', key: 'partyDice', value: { x: 1 } },
      },
    ];
    const { updates } = applyV2LifecycleMutations(els, mutations, 'c2');
    const u1 = updates.find((u) => u.instanceId === 'c1');
    expect(u1?.updates?.conditions).toEqual([]);
  });
});

describe('applyTableOp set-table-feature-state', () => {
  it('persists table_state.featureState', () => {
    const state = { activeElements: [], featureState: { Rally: { a: 1 } } };
    const ch = applyTableOp({ op: 'set-table-feature-state', featureState: { Rally: { partyDice: {} } } }, state);
    expect(ch.featureState).toEqual({ Rally: { partyDice: {} } });
  });
});
