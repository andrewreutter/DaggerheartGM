import { describe, it, expect } from 'vitest';
import { DreadVisage } from '../../../../src/features-v2/ancestries/Infernis.js';
import { runIntent, mockTable } from '../helpers.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Dread Visage', () => {
  it('has advantage trigger for intimidating hostile creatures', () => {
    const table = mockTable({
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        trait: 'Presence',
      },
    });

    const resolved = unwrapAll(DreadVisage.advantageTriggers, table);
    expect(resolved).toContain('rolls to intimidate hostile creatures');
  });

  it('is a purely declarative feature', () => {
    expect(DreadVisage.chips).toBeUndefined();
    expect(DreadVisage.hooks).toBeUndefined();
    expect(DreadVisage.advantageTriggers).toBeDefined();
  });
});
