import { describe, it, expect } from 'vitest';
import { NaturalClimber } from '../../../../src/features-v2/ancestries/Simiah.js';
import { mockTable } from '../helpers.js';
import { isWhen, unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Natural Climber', () => {
  it('has an advantage trigger wrapped in when()', () => {
    expect(NaturalClimber.advantageTriggers).toBeDefined();
    expect(NaturalClimber.advantageTriggers).toHaveLength(1);
    expect(isWhen(NaturalClimber.advantageTriggers[0])).toBe(true);
  });

  it('resolves the trigger when action trait is Agility', () => {
    const table = mockTable({ action: { type: 'trait', trait: 'Agility', actorInstanceId: 'char-1', effects: [], appliedEffects: [] } });
    const resolved = unwrapAll(NaturalClimber.advantageTriggers, table);
    expect(resolved).toContain('Agility Rolls that involve balancing and climbing');
  });

  it('does not resolve the trigger when action trait is not Agility', () => {
    const table = mockTable({ action: { type: 'trait', trait: 'Presence', actorInstanceId: 'char-1', effects: [], appliedEffects: [] } });
    const resolved = unwrapAll(NaturalClimber.advantageTriggers, table);
    expect(resolved).toHaveLength(0);
  });

  it('does not resolve the trigger when there is no action', () => {
    const table = mockTable({ action: undefined });
    const resolved = unwrapAll(NaturalClimber.advantageTriggers, table);
    expect(resolved).toHaveLength(0);
  });
});
