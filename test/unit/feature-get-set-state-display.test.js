import { describe, it, expect } from 'vitest';
import { getFeatureGetSetStateLines } from '../../src/client/lib/feature-get-set-state-display.js';

describe('getFeatureGetSetStateLines', () => {
  it('returns empty for missing element', () => {
    expect(getFeatureGetSetStateLines(undefined)).toEqual([]);
    expect(getFeatureGetSetStateLines({})).toEqual([]);
  });

  it('when featureStateDeclared is absent, flattens V2 featureState but skips _v2t: and legacy WingedSentinel.flying', () => {
    const el = {
      featureState: {
        WardenOfTheElements: { channeledElement: 'srd-bf-wolf', auraActive: true },
        Rally: { partyDice: [1, 2] },
      },
      _originFeatureState: {
        Seaborne: { tideTokens: 2 },
      },
    };
    const lines = getFeatureGetSetStateLines(el);
    expect(lines.find((l) => l.lineKey === 'WardenOfTheElements.channeledElement')).toEqual({
      lineKey: 'WardenOfTheElements.channeledElement',
      value: 'srd-bf-wolf',
    });
    expect(lines.find((l) => l.lineKey === 'WardenOfTheElements.auraActive')).toEqual({
      lineKey: 'WardenOfTheElements.auraActive',
      value: 'true',
    });
    expect(lines.find((l) => l.lineKey === 'Rally.partyDice')).toEqual({
      lineKey: 'Rally.partyDice',
      value: '[1,2]',
    });
    expect(lines.find((l) => l.lineKey === 'Seaborne.tideTokens')).toEqual({
      lineKey: 'Seaborne.tideTokens',
      value: '2',
    });
  });

  it('legacy fallback omits setInternal toggle keys (_v2t:) from V2 bags', () => {
    const el = {
      featureState: {
        WingedSentinel: {
          powerOfTheGodsMastery: true,
          '_v2t:Wings of Light::Flying::card': true,
          flying: false,
        },
      },
    };
    const keys = getFeatureGetSetStateLines(el).map((l) => l.lineKey).sort();
    expect(keys).toEqual(['WingedSentinel.powerOfTheGodsMastery']);
  });

  it('with featureStateDeclared, only lists keys marked declared for V2', () => {
    const el = {
      featureState: {
        WardenOfTheElements: { channeledElement: 'srd-bf-wolf', auraActive: true },
        Rally: { partyDice: [1, 2] },
      },
      featureStateDeclared: {
        WardenOfTheElements: { channeledElement: true },
        Rally: { partyDice: true },
      },
    };
    const keys = getFeatureGetSetStateLines(el).map((l) => l.lineKey).sort();
    expect(keys).toEqual(['Rally.partyDice', 'WardenOfTheElements.channeledElement']);
  });

  it('prefers V2 featureState when the same scope.key exists in both', () => {
    const el = {
      featureState: { Foo: { x: 1 } },
      _originFeatureState: { Foo: { x: 99 } },
    };
    const lines = getFeatureGetSetStateLines(el);
    expect(lines.filter((l) => l.lineKey === 'Foo.x')).toEqual([{ lineKey: 'Foo.x', value: '1' }]);
  });

  it('merges distinct keys from both bags', () => {
    const el = {
      featureState: { A: { a: 1 } },
      _originFeatureState: { B: { b: 2 } },
    };
    expect(getFeatureGetSetStateLines(el).map((l) => l.lineKey).sort()).toEqual(['A.a', 'B.b']);
  });

  it('with _originFeatureStateDeclared, only lists declared legacy keys', () => {
    const el = {
      _originFeatureState: {
        Seaborne: { tideTokens: 2, other: 0 },
      },
      _originFeatureStateDeclared: {
        Seaborne: { tideTokens: true },
      },
    };
    const lines = getFeatureGetSetStateLines(el);
    expect(lines.map((l) => l.lineKey)).toEqual(['Seaborne.tideTokens']);
  });
});
