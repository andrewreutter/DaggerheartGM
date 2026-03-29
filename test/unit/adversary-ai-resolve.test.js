import { describe, it, expect } from 'vitest';
import { resolveAdversaryAiDraft } from '../../src/adversary-ai-resolve.js';
import { getBaselineStats } from '../../src/client/lib/adversary-defaults.js';

describe('adversary-ai-resolve', () => {
  it('normalizes role and clamps tier', () => {
    const { patch, warnings } = resolveAdversaryAiDraft({
      name: 'Test',
      role: 'BRUISER',
      tier: 99,
    });
    expect(patch.role).toBe('bruiser');
    expect(patch.tier).toBe(4);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('fills stats from guide baseline when missing', () => {
    const { patch } = resolveAdversaryAiDraft({
      name: 'Gob',
      role: 'standard',
      tier: 1,
    });
    const b = getBaselineStats('standard', 1);
    expect(patch.difficulty).toBe(b.difficulty);
    expect(patch.hp_max).toBe(b.hp_max);
    expect(patch.attack.damage).toBe(b.attack.damage);
  });

  it('respects lockTier and lockRole over draft', () => {
    const { patch } = resolveAdversaryAiDraft(
      { name: 'X', role: 'horde', tier: 1 },
      { lockTier: 3, lockRole: 'bruiser' },
    );
    expect(patch.tier).toBe(3);
    expect(patch.role).toBe('bruiser');
  });

  it('assigns ids to features and experiences', () => {
    const { patch } = resolveAdversaryAiDraft({
      name: 'X',
      role: 'horde',
      tier: 1,
      experiences: [{ name: 'Scary places', modifier: 2 }],
      features: [{ name: 'Pack tactics', type: 'passive', description: 'Foo' }],
    });
    expect(patch.experiences[0].id).toBeTruthy();
    expect(patch.features[0].id).toBeTruthy();
    expect(patch.experiences[0].modifier).toBe(2);
  });
});
