import { describe, it, expect } from 'vitest';
import { DevastatingStrikes } from '../../../../src/features-v2/beastforms/TerribleLizard.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { mergeGameStateWithActionConfig } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction } from '../helpers.js';

describe('Terrible Lizard — Devastating Strikes', () => {
  it('reviewOutcome chip increases HP loss by 1 when Severe damage to adversary in Melee', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });

    const base = mockGameState({
      activeElements: [char, adv],
      currentActorInstanceId: 'char-1',
    });
    const merged = mergeGameStateWithActionConfig(
      base,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] })
    );
    merged.action.effects = [
      {
        stat: 'currentHP',
        target: adv,
        amount: 3,
        damageTier: 'severe',
      },
    ];

    const feature = { ...DevastatingStrikes, _ownerInstanceId: 'char-1' };
    const table = buildTableSnapshot({
      ...merged,
      _ownerInstanceId: 'char-1',
      _featureKey: feature.name,
      _activeFeature: feature,
    });

    const chips = collectChips([feature], 'reviewOutcome', table, {});
    expect(chips.length).toBe(1);
    chips[0].onUse(table, {});
    expect(merged.action.effects[0].amount).toBe(4);
  });
});
