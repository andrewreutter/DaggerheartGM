import { describe, it, expect } from 'vitest';
import {
  buildAdversaryFeatureRollParts,
  resolveBannerAttackerElement,
  applyAdversaryRollMetaBasics,
  pickAdversaryAttackerIds,
} from '../../src/client/lib/adversary-roll-descriptors.js';

describe('buildAdversaryFeatureRollParts', () => {
  it('parses SRD-style action attack line into _rollData', () => {
    const feature = {
      type: 'action',
      name: 'Longbow',
      description: '+3 Far | 2d6 phy',
    };
    const { _rollData, _diceRoll } = buildAdversaryFeatureRollParts(feature, {}, {});
    expect(_rollData).toEqual({
      modifier: 3,
      range: 'Far',
      damage: '2d6',
      trait: 'phy',
    });
    expect(_diceRoll).toBe(null);
  });

  it('returns dice-only _diceRoll when no attack line but dice in text', () => {
    const feature = {
      type: 'action',
      name: 'Hex',
      description: 'Take 2d8 magic damage.',
    };
    const { _rollData, _diceRoll } = buildAdversaryFeatureRollParts(feature, {}, {});
    expect(_rollData).toBe(null);
    expect(_diceRoll?.patterns).toContain('2d8');
  });
});

describe('resolveBannerAttackerElement', () => {
  it('resolves adversary attacker from display map when roll is adversary-typed', () => {
    const adv = { instanceId: 'adv-1', elementType: 'adversary', activeFeatures: [{ name: 'Test' }] };
    const m = new Map([['adv-1', adv]]);
    const roll = { _attackerInstanceId: 'adv-1', _attackerType: 'adversary' };
    expect(resolveBannerAttackerElement(roll, { tableCharacters: [], adversaryDisplayByInstanceId: m })).toBe(adv);
  });

  it('prefers PC sheet when not adversary-typed', () => {
    const pc = { instanceId: 'pc-1', elementType: 'character', name: 'Hero' };
    const adv = { instanceId: 'pc-1', elementType: 'adversary', name: 'Wrong' };
    const m = new Map([['pc-1', adv]]);
    const roll = { _attackerInstanceId: 'pc-1' };
    expect(resolveBannerAttackerElement(roll, { tableCharacters: [pc], adversaryDisplayByInstanceId: m })).toBe(pc);
  });
});

describe('applyAdversaryRollMetaBasics + pickAdversaryAttackerIds', () => {
  it('golden shape for adversary attack postRoll meta', () => {
    const instances = [
      { instanceId: 'a1', tokenX: 10, tokenY: 10 },
    ];
    const rollMeta = { ...pickAdversaryAttackerIds(instances) };
    applyAdversaryRollMetaBasics(rollMeta, { featureKey: 'feat-0', featureName: 'Slam' });
    expect(rollMeta).toEqual({
      _attackerInstanceId: 'a1',
      _attackerType: 'adversary',
      _advFeatureKey: 'feat-0',
      _advFeatureName: 'Slam',
    });
  });
});
