import { describe, it, expect } from 'vitest';
import {
  characterHasFeatureCardActions,
  characterHasLoadoutCardActions,
} from '../../src/client/lib/character-sheet-card-actions.js';

describe('characterHasLoadoutCardActions', () => {
  it('is true when a domain ability row has V2 card chips', () => {
    const el = {
      abilities: [{ id: 'abl-1', name: 'Test Spell', domain: 'Arcana', type: 'Spell', level: 1 }],
      activeFeatures: [
        {
          name: 'Test Spell',
          type: 'ability',
          chips: [{ name: 'Use', placements: ['card'] }],
        },
      ],
    };
    expect(characterHasLoadoutCardActions(el, {})).toBe(true);
  });

  it('is false when there are no domain abilities', () => {
    const el = { abilities: [], activeFeatures: [] };
    expect(characterHasLoadoutCardActions(el, {})).toBe(false);
  });
});

describe('characterHasFeatureCardActions (combined Features + Loadout)', () => {
  it('is true when only loadout has chips', () => {
    const el = {
      classFeatures: [],
      abilities: [{ name: 'Zap', domain: 'Arcana', type: 'Spell', level: 1 }],
      activeFeatures: [
        {
          name: 'Zap',
          type: 'ability',
          chips: [{ name: 'Use', placements: ['card'] }],
        },
      ],
    };
    expect(characterHasFeatureCardActions(el, () => {}, {})).toBe(true);
  });
});
