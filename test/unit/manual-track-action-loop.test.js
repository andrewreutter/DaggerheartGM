import { describe, it, expect } from 'vitest';
import {
  findPendingManualTrackBanner,
  mergeManualTrackDisplay,
  buildManualTrackActionRoll,
  getPendingManualTrackAckDeltas,
  getLifeSupportPendingHealSlots,
} from '../../src/client/lib/manual-track-action-loop.js';

describe('manual-track-action-loop', () => {
  it('findPendingManualTrackBanner returns latest matching roll', () => {
    const pending = [
      { _rollDbId: 1, _manualTrackEdit: true, _targetInstanceId: 'a', _manualUpdates: { hope: 2 } },
      { _rollDbId: 2, _manualTrackEdit: true, _targetInstanceId: 'b', _manualUpdates: { currentHp: 3 } },
      { _rollDbId: 3, _manualTrackEdit: true, _targetInstanceId: 'a', _manualUpdates: { currentStress: 4 } },
    ];
    expect(findPendingManualTrackBanner(pending, 'a')?._manualUpdates?.currentStress).toBe(4);
    expect(findPendingManualTrackBanner(pending, 'b')?._manualUpdates?.currentHp).toBe(3);
    expect(findPendingManualTrackBanner([], 'a')).toBeNull();
  });

  it('mergeManualTrackDisplay merges character and companion fields', () => {
    const el = {
      instanceId: 'x',
      name: 'Hero',
      currentHp: 10,
      companion: { name: 'Wolf', currentStress: 1, maxStress: 3 },
    };
    const roll = {
      _manualUpdates: { currentHp: 8, companion: { currentStress: 2 } },
    };
    const m = mergeManualTrackDisplay(el, roll);
    expect(m.currentHp).toBe(8);
    expect(m.companion.currentStress).toBe(2);
    expect(m.companion.name).toBe('Wolf');
  });

  it('buildManualTrackActionRoll sets short titles and sentence bodies', () => {
    const r = buildManualTrackActionRoll(
      {
        instanceId: 'i',
        name: 'Zed',
        elementType: 'character',
        maxHp: 10,
        maxStress: 6,
        maxHope: 6,
        maxArmor: 4,
        currentHp: 10,
        hope: 5,
        currentArmor: 0,
      },
      { currentHp: 5, hope: 3, currentArmor: 2 }
    );
    expect(r._manualTrackEdit).toBe(true);
    expect(r._targetInstanceId).toBe('i');
    expect(r._manualUpdates.currentHp).toBe(5);
    expect(r.actionName).toContain('Mark 5 damage');
    expect(r.actionName).toContain('Spend 2 Hope');
    expect(r.actionName).toContain('Mark 2 armor');
    expect(r.actionText).toContain('HP marked will change from 0 to 5');
    expect(r.actionText).toContain('Hope marked will change from 1 to 3');
    expect(r.actionText).toContain('Armor marked will change from 0 to 2');
  });

  it('getPendingManualTrackAckDeltas returns stress and HP deltas vs server el', () => {
    const el = { instanceId: 'c1', maxHp: 10, currentHp: 5, currentStress: 2, maxStress: 6 };
    const pending = {
      _manualTrackEdit: true,
      _manualUpdates: { currentHp: 7, currentStress: 4 },
    };
    const d = getPendingManualTrackAckDeltas(el, pending);
    expect(d.stressAdd).toBe(2);
    expect(d.hpHealSlots).toBe(2);
    expect(d.hpDamageAdd).toBe(0);
  });

  it('getPendingManualTrackAckDeltas returns hopeSpend and hopeGain for CheckboxTrack pending overlays', () => {
    const el = { instanceId: 'c1', maxHope: 6, hope: 5 };
    const spendPending = { _manualTrackEdit: true, _manualUpdates: { hope: 3 } };
    const ds = getPendingManualTrackAckDeltas(el, spendPending);
    expect(ds.hopeSpend).toBe(2);
    expect(ds.hopeGain).toBe(0);

    const gainEl = { instanceId: 'c1', maxHope: 6, hope: 2 };
    const gainPending = { _manualTrackEdit: true, _manualUpdates: { hope: 5 } };
    const dg = getPendingManualTrackAckDeltas(gainEl, gainPending);
    expect(dg.hopeGain).toBe(3);
    expect(dg.hopeSpend).toBe(0);
  });

  it('getLifeSupportPendingHealSlots returns 1 when ally is selected for pending Life Support banner', () => {
    const banners = [
      { _action: true, _featureName: 'Other', _rollDbId: 9 },
      { _action: true, _featureName: 'Life Support', _rollDbId: 42 },
    ];
    expect(getLifeSupportPendingHealSlots(banners, { 42: 'ally-1' }, 'ally-1')).toBe(1);
    expect(getLifeSupportPendingHealSlots(banners, { 42: 'ally-1' }, 'other')).toBe(0);
  });
});
