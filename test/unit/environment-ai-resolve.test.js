import { describe, it, expect } from 'vitest';
import { resolveEnvironmentAiDraft } from '../../src/environment-ai-resolve.js';

describe('environment-ai-resolve', () => {
  it('respects lockTier and lockType over draft', () => {
    const { patch } = resolveEnvironmentAiDraft(
      { name: 'X', tier: 1, type: 'exploration' },
      { lockTier: 4, lockType: 'social' },
    );
    expect(patch.tier).toBe(4);
    expect(patch.type).toBe('social');
  });

  it('defaults type and clamps tier', () => {
    const { patch } = resolveEnvironmentAiDraft({
      name: 'Ruins',
      tier: 0,
      type: 'bogus',
    });
    expect(patch.type).toBe('exploration');
    expect(patch.tier).toBe(1);
  });

  it('normalizes potential_adversaries from comma string', () => {
    const { patch } = resolveEnvironmentAiDraft({
      name: 'Swamp',
      potential_adversaries: 'Bear, Dire Wolf',
    });
    expect(patch.potential_adversaries).toEqual([{ name: 'Bear' }, { name: 'Dire Wolf' }]);
  });

  it('assigns feature ids', () => {
    const { patch } = resolveEnvironmentAiDraft({
      name: 'E',
      features: [{ name: 'Hazard', type: 'action', description: 'd' }],
    });
    expect(patch.features[0].id).toBeTruthy();
    expect(patch.features[0].type).toBe('action');
  });
});
