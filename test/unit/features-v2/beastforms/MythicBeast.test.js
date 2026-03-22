import { describe, it, expect } from 'vitest';
import { Evolved } from '../../../../src/features-v2/beastforms/MythicBeast.js';
import { mergeGameStateWithActionConfig } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction } from '../helpers.js';

function runEvolvedReviewAction(actionConfig, effects) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  const base = mockGameState({
    activeElements: [char, adv],
    currentActorInstanceId: 'char-1',
  });
  const merged = mergeGameStateWithActionConfig(base, mockAction(actionConfig));
  merged.action.effects = effects;

  const table = buildTableSnapshot({
    ...merged,
    _ownerInstanceId: 'char-1',
    _featureKey: 'Evolved',
    _activeFeature: Evolved,
  });

  const hook = unwrap(Evolved.hooks.onReviewAction, table);
  if (typeof hook === 'function') hook(table);

  return merged.action.effects;
}

describe('Mythic Beast — Evolved', () => {
  it('adds +9 to pending damage for the attack target during reviewAction when attacking', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = runEvolvedReviewAction(
      {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      [
        {
          type: 'damage',
          target: adv,
          amount: 4,
          damageType: 'physical',
          source: char,
        },
      ]
    );
    expect(effects).toContainEqual(
      expect.objectContaining({
        type: 'damage',
        amount: 13,
        damageType: 'physical',
      })
    );
  });
});
