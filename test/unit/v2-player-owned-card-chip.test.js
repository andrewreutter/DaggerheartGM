import { describe, it, expect } from 'vitest';
import { computePlayerV2OwnedCardChipApply } from '../../src/server/v2-player-owned-card-chip.js';
import { withActionBannerSuppression } from '../../src/client/lib/action-notification-banner.js';
import { mockCharacter, mockAdversary } from './features-v2/helpers.js';

describe('computePlayerV2OwnedCardChipApply', () => {
  it('returns 400 when chipName is missing', () => {
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const r = computePlayerV2OwnedCardChipApply({
      activeElements: [bard],
      tableState: {},
      ownerInstanceId: 'b1',
      featureName: 'Make a Scene',
      chipName: '',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('Make a Scene: applies adversary difficultyMod and owner Hope spend (multi-instance)', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      hope: 5,
      classId: 'srd-cls-bard',
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 5,
      tokenY: 0,
      difficulty: 14,
    });

    const r = computePlayerV2OwnedCardChipApply({
      activeElements: [bard, adv],
      tableState: { fearCount: 0 },
      ownerInstanceId: 'b1',
      featureName: 'Make a Scene',
      chipName: 'Make a Scene',
      selectOpts: { selectedTargetIds: ['adv-1'] },
    });

    expect(r.ok).toBe(true);
    expect(r.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instanceId: 'b1',
          updates: expect.objectContaining({ hope: 2 }),
        }),
        expect.objectContaining({
          instanceId: 'adv-1',
          updates: expect.objectContaining({ difficultyMod: -2 }),
        }),
      ])
    );
    expect(r.actionLoopNotifications?.length).toBeGreaterThanOrEqual(1);
    // Server must mirror client `withActionBannerSuppression` so these narrations
    // append as acknowledged log rows — not pending banners that block the sheet.
    const notice = r.actionLoopNotifications[0];
    const payload = withActionBannerSuppression(
      {
        _action: true,
        rollUser: notice.rollUser || 'Table',
        actionName: notice.title,
        actionText: notice.description || '',
        _v2ActionLoop: true,
        _reactorInstanceId: notice.instanceId,
      },
      { actionAdversaryTargets: [] }
    );
    expect(payload._suppressActionBanner).toBe(true);
  });

  it('Contacts Everywhere: Reliable Backup allows 3 session uses with featureUsage count', () => {
    // Library-resolved syndicate PC without sheet overlay — activate must stamp
    // contactsEverywhereSessionUses from applyDeclarativeFeatures onto table.me.
    const vex = mockCharacter({
      instanceId: 'v1',
      classId: 'srd-cls-rogue',
      subclassId: 'srd-sub-syndicate',
      level: 8,
      hope: 6,
      featureUsage: {},
      featureState: {},
    });
    const usageKey = 'srd-sub-syndicate-spec-feat-contacts-everywhere';
    const r1 = computePlayerV2OwnedCardChipApply({
      activeElements: [vex],
      tableState: { fearCount: 0 },
      ownerInstanceId: 'v1',
      featureName: 'Contacts Everywhere',
      chipName: 'Contacts Everywhere',
      selectOpts: { selectedId: 'hpShield' },
      passedFeatureKey: usageKey,
    });
    expect(r1.ok).toBe(true);
    expect(r1.updates[0].updates.featureState?.['Contacts Everywhere']?.pendingHpShield).toBe(true);
    expect(r1.updates[0].updates.featureUsage?.[usageKey]).toEqual({
      cycle: 'session',
      count: 1,
      used: false,
    });

    const after1 = {
      ...vex,
      featureUsage: r1.updates[0].updates.featureUsage,
      featureState: r1.updates[0].updates.featureState,
    };
    const r2 = computePlayerV2OwnedCardChipApply({
      activeElements: [after1],
      tableState: { fearCount: 0 },
      ownerInstanceId: 'v1',
      featureName: 'Contacts Everywhere',
      chipName: 'Contacts Everywhere',
      selectOpts: { selectedId: 'presenceD20' },
      passedFeatureKey: usageKey,
    });
    expect(r2.ok).toBe(true);
    expect(r2.updates[0].updates.featureUsage?.[usageKey]?.count).toBe(2);
    expect(r2.updates[0].updates.featureUsage?.[usageKey]?.used).toBe(false);
  });

  it("Warden's Protection: clears ally HP and spends owner Hope (multi-instance)", () => {
    const druid = mockCharacter({
      instanceId: 'd1',
      tokenX: 0,
      tokenY: 0,
      hope: 4,
      classId: 'srd-cls-druid',
      subclassId: 'srd-sub-warden-of-renewal',
      level: 8,
    });
    const ally = mockCharacter({
      instanceId: 'c2',
      tokenX: 5,
      tokenY: 0,
      currentHp: 2,
      maxHp: 6,
    });

    // Own activate path does not yet thread `_rng`; d4 still rolls — assert ally heal + Hope spend.
    const r = computePlayerV2OwnedCardChipApply({
      activeElements: [druid, ally],
      tableState: { fearCount: 0 },
      ownerInstanceId: 'd1',
      featureName: "Warden's Protection",
      chipName: "Warden's Protection",
      selectOpts: { selectedTargetIds: ['c2'] },
    });

    expect(r.ok).toBe(true);
    const allyHp = r.updates.find((u) => u.instanceId === 'c2' && u.updates.currentHp != null);
    expect(allyHp).toBeDefined();
    expect(allyHp.updates.currentHp).toBe(4); // clearHP(2) from 2 → 4
    const hopeSpend = r.updates.find((u) => u.instanceId === 'd1' && u.updates.hope != null);
    expect(hopeSpend).toBeDefined();
    expect(hopeSpend.updates.hope).toBe(2);
  });
});
