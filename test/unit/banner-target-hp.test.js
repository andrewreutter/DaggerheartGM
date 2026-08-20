import { describe, expect, it } from 'vitest';
import {
  adjustBannerTargetHpLoss,
  bannerTargetHpLossMax,
  defaultBannerTargetHpLoss,
  resolveBannerTargetHpLoss,
} from '../../src/client/lib/banner-target-hp.js';

describe('defaultBannerTargetHpLoss', () => {
  const thresholds = { major: 8, severe: 15 };

  it('starts a miss at 0 so the GM can leave it unapplied', () => {
    expect(defaultBannerTargetHpLoss({ displayDmg: 20, thresholds, isMiss: true })).toBe(0);
  });

  it('uses threshold HP on a hit', () => {
    expect(defaultBannerTargetHpLoss({ displayDmg: 5, thresholds, isMiss: false })).toBe(1);
    expect(defaultBannerTargetHpLoss({ displayDmg: 10, thresholds, isMiss: false })).toBe(2);
    expect(defaultBannerTargetHpLoss({ displayDmg: 16, thresholds, isMiss: false })).toBe(3);
  });

  it('marks 1 companion Stress on a hit and 0 on a miss', () => {
    expect(defaultBannerTargetHpLoss({ isCompanion: true, isMiss: false })).toBe(1);
    expect(defaultBannerTargetHpLoss({ isCompanion: true, isMiss: true, displayDmg: 20 })).toBe(0);
  });
});

describe('adjustBannerTargetHpLoss', () => {
  it('clamps at 0 and max', () => {
    expect(adjustBannerTargetHpLoss(1, -1, 3)).toBe(0);
    expect(adjustBannerTargetHpLoss(0, -1, 3)).toBe(0);
    expect(adjustBannerTargetHpLoss(2, 1, 3)).toBe(3);
    expect(adjustBannerTargetHpLoss(3, 1, 3)).toBe(3);
  });
});

describe('bannerTargetHpLossMax', () => {
  it('is at least current HP, the default, and 3', () => {
    expect(bannerTargetHpLossMax({ currentHp: 5, maxHp: 6 }, 2)).toBe(5);
    expect(bannerTargetHpLossMax({ currentHp: 1, maxHp: 6 }, 3)).toBe(3);
    expect(bannerTargetHpLossMax({}, 0)).toBe(3);
  });

  it('caps companions at 1 Stress unless the default is higher', () => {
    expect(bannerTargetHpLossMax({ type: 'companion' }, 1)).toBe(1);
  });
});

describe('resolveBannerTargetHpLoss', () => {
  it('uses a GM override when present, otherwise the default', () => {
    expect(resolveBannerTargetHpLoss({ t1: 0 }, 't1', 2)).toBe(0);
    expect(resolveBannerTargetHpLoss({}, 't1', 2)).toBe(2);
    expect(resolveBannerTargetHpLoss(null, 't1', 2)).toBe(2);
  });
});
