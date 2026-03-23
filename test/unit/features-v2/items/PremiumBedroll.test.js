import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { PremiumBedroll } from '../../../../src/features-v2/items/PremiumBedroll.js';
import registry from '../../../../src/features-v2/registry.js';
import { runIntent, mockCharacter, mockAdversary } from '../helpers.js';

describe('Items — Premium Bedroll', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Premium Bedroll', id: 'srd-itm-premium-bedroll' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Premium Bedroll',
        _source: 'item',
        hooks: PremiumBedroll.hooks,
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Premium Bedroll' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Premium Bedroll' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Premium Bedroll', id: 'srd-itm-premium-bedroll' },
          { name: 'Premium Bedroll', id: 'srd-itm-premium-bedroll' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Premium Bedroll').length).toBe(1);
  });

  it('clears 1 Stress during a short rest', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentStress: 3, maxStress: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...PremiumBedroll, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'shortRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: { instanceId: 'char-1', amount: 1 },
      })
    );
  });

  it('clears 1 Stress during a long rest', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentStress: 2, maxStress: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...PremiumBedroll, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'longRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: { instanceId: 'char-1', amount: 1 },
      })
    );
  });

  it('does not clear Stress on a regular attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...PremiumBedroll, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'attack',
      }
    );

    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });
});
