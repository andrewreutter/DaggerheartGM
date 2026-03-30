import { describe, it, expect } from 'vitest';
import { buildForcedMovementActionNotification } from '../../src/client/lib/v2-forced-movement-banner.js';

describe('buildForcedMovementActionNotification', () => {
  it('joins desiredCondition and description', () => {
    const n = buildForcedMovementActionNotification(
      {
        instanceId: 'c1',
        desiredCondition: 'Very Close from attacker',
        description: 'Kick: leap back.',
      },
      [{ instanceId: 'c1', elementType: 'character', name: 'Pip' }]
    );
    expect(n.rollUser).toBe('Pip');
    expect(n.actionName).toBe('Forced movement');
    expect(n.actionText).toBe('Very Close from attacker — Kick: leap back.');
    expect(n._action).toBe(true);
  });

  it('falls back when strings empty', () => {
    const n = buildForcedMovementActionNotification({ instanceId: 'x' }, []);
    expect(n.rollUser).toBe('Character');
    expect(n.actionText).toMatch(/forced movement/i);
  });
});
