import { describe, it, expect } from 'vitest';
import { PurposefulDesign } from '../../../../src/features-v2/ancestries/Clank.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { mockTable } from '../helpers.js';

describe('PurposefulDesign', () => {
  it('has a create-phase chip for choosing an Experience', () => {
    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const table = mockTable({ _ownerInstanceId: 'char-1' });

    const chips = collectChips(features, 'create', table);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Purposeful Design');
    expect(chips[0].placements).toContain('create');
  });

  it('does not show a chip during the review phase', () => {
    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const table = mockTable({ _ownerInstanceId: 'char-1' });

    const chips = collectChips(features, 'reviewOutcome', table);
    expect(chips).toHaveLength(0);
  });
});
