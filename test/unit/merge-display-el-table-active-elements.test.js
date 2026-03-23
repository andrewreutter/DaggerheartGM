import { describe, it, expect } from 'vitest';
import {
  mergeDisplayElIntoTableActiveElements,
  buildGuideFeatureTableSnapshot,
  V2_TABLE_STUB_NO_INSTANCE_ID,
} from '../../src/client/lib/build-feature-card-model.js';
import { buildTableSnapshot } from '../../src/features-v2/engine/table.js';
import registry from '../../src/features-v2/registry.js';

describe('mergeDisplayElIntoTableActiveElements', () => {
  it('overlays display el onto the matching table row; pass registry on snapshot for Druid isSelect', () => {
    const displayEl = {
      instanceId: 'pc-1',
      elementType: 'character',
      name: 'Druid',
      classId: 'srd-cls-druid',
      level: 1,
    };
    const tableRow = {
      instanceId: 'pc-1',
      elementType: 'character',
      name: 'Druid',
      currentHp: 5,
    };
    const merged = mergeDisplayElIntoTableActiveElements(displayEl, {
      activeElements: [tableRow, { instanceId: 'adv-1', elementType: 'adversary' }],
    });
    expect(merged[0].classId).toBe('srd-cls-druid');
    expect(merged[1]).toEqual({ instanceId: 'adv-1', elementType: 'adversary' });

    const table = buildTableSnapshot({
      registry,
      activeElements: merged,
      _ownerInstanceId: 'pc-1',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'pc-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    expect(table.me).not.toBeNull();
    expect(typeof table.me?.rangeFrom).toBe('function');
    expect(Object.keys(table.registry.beastforms).length).toBeGreaterThan(0);
  });

  it('appends the display el when activeElements omits the owner (so buildTableSnapshot table.me is not null)', () => {
    const displayEl = {
      instanceId: 'pc-missing',
      elementType: 'character',
      name: 'Bard',
      tokenX: 0,
      tokenY: 0,
    };
    const merged = mergeDisplayElIntoTableActiveElements(displayEl, {
      activeElements: [{ instanceId: 'other-pc', elementType: 'character', name: 'Other' }],
    });
    expect(merged.some((a) => (a.instanceId || a.id) === 'pc-missing')).toBe(true);

    const table = buildTableSnapshot({
      activeElements: merged,
      _ownerInstanceId: 'pc-missing',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'pc-missing',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    expect(table.me).not.toBeNull();
    expect(typeof table.me?.rangeFrom).toBe('function');
  });

  it('merges by library id when instanceId is absent (preview / new character)', () => {
    const displayEl = {
      id: 'new-char-1',
      elementType: 'character',
      name: 'Bard',
      classId: 'srd-cls-bard',
    };
    const merged = mergeDisplayElIntoTableActiveElements(displayEl, { activeElements: [] });
    expect(merged).toHaveLength(1);
    expect(merged[0].instanceId).toBe('new-char-1');

    const table = buildGuideFeatureTableSnapshot(displayEl, { name: 'Rally' }, {});
    expect(table.me).not.toBeNull();
    expect(typeof table.me?.rangeFrom).toBe('function');
  });

  it('stub table.me exposes rangeFrom so isDisabled predicates do not throw', () => {
    expect(typeof V2_TABLE_STUB_NO_INSTANCE_ID.me?.rangeFrom).toBe('function');
    expect(V2_TABLE_STUB_NO_INSTANCE_ID.me.rangeFrom({})).toBeNull();
  });
});
