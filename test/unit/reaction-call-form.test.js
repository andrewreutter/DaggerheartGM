import { describe, expect, it } from 'vitest';
import { shapeReactionCallPayload } from '../../src/client/lib/reaction-call-form.js';

const characters = [
  { instanceId: 'c1', name: 'Ada' },
  { instanceId: 'c2', name: 'Bea' },
  { instanceId: 'c3', name: 'Cin' },
];

describe('shapeReactionCallPayload', () => {
  it('keeps selected ids in table order and omits overrides that match the default', () => {
    expect(shapeReactionCallPayload({
      selectedIds: new Set(['c3', 'c1']),
      characters,
      trait: 'agility',
      difficulty: 12,
      traitOverrides: { c1: 'presence', c3: 'agility', c2: 'knowledge' },
    })).toEqual({
      targetInstanceIds: ['c1', 'c3'],
      trait: 'agility',
      difficulty: 12,
      traitOverrides: { c1: 'presence' },
    });
  });

  it('drops unchecked overrides and invalid trait keys', () => {
    expect(shapeReactionCallPayload({
      selectedIds: ['c2'],
      characters,
      trait: 'instinct',
      difficulty: 10.4,
      traitOverrides: { c2: 'not-a-trait', c1: 'presence' },
    })).toEqual({
      targetInstanceIds: ['c2'],
      trait: 'instinct',
      difficulty: 10,
      traitOverrides: {},
    });
  });
});
