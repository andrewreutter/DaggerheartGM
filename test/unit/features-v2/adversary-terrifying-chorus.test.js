import { describe, it, expect } from 'vitest';
import { TerrifyingChorus } from '../../../src/features-v2/adversary_features/TerrifyingChorus.js';
import { buildTableSnapshot, applyMutations } from '../../../src/features-v2/engine/table.js';
import { applyV2BannerMutations } from '../../../src/client/lib/table-ops.js';

describe('TerrifyingChorus onUse', () => {
  it('queues spendHope for each PC within Far; skips PCs beyond Far', () => {
    const activeElements = [
      { instanceId: 'adv1', elementType: 'adversary', name: 'X', tokenX: 0, tokenY: 0, currentStress: 0, maxStress: 8 },
      { instanceId: 'c1', elementType: 'character', hope: 5, maxHope: 6, tokenX: 50, tokenY: 0 },
      { instanceId: 'c2', elementType: 'character', hope: 3, maxHope: 6, tokenX: 500, tokenY: 0 },
    ];
    const gameState = {
      fear: 5,
      activeElements,
      _ownerInstanceId: 'adv1',
    };
    const table = buildTableSnapshot(gameState);
    TerrifyingChorus.onUse(table);
    const mutations = applyMutations(table);
    const spendHopes = mutations.filter((m) => m.type === 'spendHope');
    expect(spendHopes).toHaveLength(1);
    expect(spendHopes[0].payload).toMatchObject({ instanceId: 'c1', amount: 2 });

    const { updates } = applyV2BannerMutations(activeElements, mutations, 'adv1');
    const byId = Object.fromEntries(updates.map((u) => [u.instanceId, u.updates]));
    expect(byId.c1.hope).toBe(3);
    expect(byId.c2).toBeUndefined();
  });
});
