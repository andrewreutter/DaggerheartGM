import { describe, it, expect } from 'vitest';
import { insertExperienceIntoRollText, getExperienceModifierForCharacter } from '../../src/client/lib/experience-roll.js';

describe('insertExperienceIntoRollText', () => {
  it('inserts after trait score token', () => {
    const base = 'Aria Agility Hope [d12] Fear [d12] Agility [3]';
    const out = insertExperienceIntoRollText(base, 'agility', 'Explorer', 2);
    expect(out).toBe('Aria Agility Hope [d12] Fear [d12] Agility [3] Explorer [2]');
  });

  it('inserts after Fear [d12] when no trait score line', () => {
    const base = 'Aria Agility Hope [d12] Fear [d12]';
    const out = insertExperienceIntoRollText(base, 'agility', 'Explorer', 2);
    expect(out).toBe('Aria Agility Hope [d12] Fear [d12] Explorer [2]');
  });

  it('returns unchanged when expName null', () => {
    const base = 'Aria Agility Hope [d12] Fear [d12] Agility [3]';
    expect(insertExperienceIntoRollText(base, 'agility', null, 2)).toBe(base);
  });
});

describe('getExperienceModifierForCharacter', () => {
  it('defaults to 2 without ancestry bonus', () => {
    expect(getExperienceModifierForCharacter({ ancestry: [], experienceBonusChoices: {} }, 'x')).toBe(2);
  });
});
