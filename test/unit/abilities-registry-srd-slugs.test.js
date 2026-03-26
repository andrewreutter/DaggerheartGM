/**
 * Every abilities barrel key must either be makeSrdListId('abilities', name) or a legacy
 * alias pointing at the same module as the canonical id (see abilities/index.js).
 */
import { describe, it, expect } from 'vitest';
import v2Abilities from '../../src/features-v2/abilities/index.js';
import { makeSrdListId } from '../../src/srd/srd-list-ids.js';

describe('abilities registry vs SRD list ids', () => {
  it('each entry resolves from canonical slug or is a documented alias', () => {
    for (const [key, mod] of Object.entries(v2Abilities)) {
      if (!mod || typeof mod.name !== 'string') continue;
      const canon = makeSrdListId('abilities', mod.name);
      expect(
        key === canon || v2Abilities[canon] === mod,
        `Key "${key}" for "${mod.name}" — expected canonical "${canon}" or same module at canonical key`,
      ).toBe(true);
    }
  });
});
