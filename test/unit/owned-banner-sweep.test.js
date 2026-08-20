import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db.js', () => ({
  getPendingBanners: vi.fn(),
  setBannerStatus: vi.fn(),
}));

import { getPendingBanners, setBannerStatus } from '../../src/db.js';
import {
  getPendingBannersAfterSweep,
  setLivePendingIntentsGetter,
  sweepOrphanedOwnedBanners,
} from '../../src/server/owned-banner-sweep.js';

const groupOrphan = {
  _rollDbId: 3595,
  _isReaction: true,
  _groupRollIntentId: 'int-dead',
};
const tagLone = {
  _rollDbId: 31,
  _tagTeamIntentId: 'tt-1',
  _tagTeamRole: 'partner',
};
const tagPeer = {
  _rollDbId: 32,
  _tagTeamIntentId: 'tt-1',
  _tagTeamRole: 'initiator',
};

beforeEach(() => {
  getPendingBanners.mockReset();
  setBannerStatus.mockReset();
  setBannerStatus.mockResolvedValue(undefined);
  setLivePendingIntentsGetter(() => new Map());
});

describe('sweepOrphanedOwnedBanners', () => {
  it('acks group leftovers whose intent is gone', async () => {
    getPendingBanners.mockResolvedValue([groupOrphan]);
    const result = await sweepOrphanedOwnedBanners('app', 'gm-1');
    expect(result).toEqual({
      changed: true,
      groupAckIds: [3595],
      tagTeamCancelIds: [],
    });
    expect(setBannerStatus).toHaveBeenCalledWith(3595, 'acknowledged');
  });

  it('leaves a lone Tag Team leftover (initiator Proceed may still be in flight)', async () => {
    getPendingBanners.mockResolvedValueOnce([tagLone]);
    const incomplete = await sweepOrphanedOwnedBanners('app', 'gm-1');
    expect(incomplete.tagTeamCancelIds).toEqual([]);
    expect(setBannerStatus).not.toHaveBeenCalled();

    getPendingBanners.mockResolvedValueOnce([tagLone, tagPeer]);
    const pair = await sweepOrphanedOwnedBanners('app', 'gm-1');
    expect(pair.changed).toBe(false);
    expect(setBannerStatus).not.toHaveBeenCalled();
  });

  it('leaves banners alone when their intent is still live', async () => {
    setLivePendingIntentsGetter(() => new Map([
      ['table-a', { intentId: 'int-dead' }],
    ]));
    getPendingBanners.mockResolvedValue([groupOrphan]);
    const result = await sweepOrphanedOwnedBanners('app', 'gm-1');
    expect(result.changed).toBe(false);
    expect(setBannerStatus).not.toHaveBeenCalled();
  });
});

describe('getPendingBannersAfterSweep', () => {
  it('returns the first snapshot when nothing was swept', async () => {
    const snapshot = [{ _rollDbId: 1, total: 12 }];
    getPendingBanners.mockResolvedValue(snapshot);
    const out = await getPendingBannersAfterSweep('app', 'gm-1');
    expect(out).toBe(snapshot);
    expect(getPendingBanners).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after acknowledging a group leftover', async () => {
    getPendingBanners
      .mockResolvedValueOnce([groupOrphan])
      .mockResolvedValueOnce([]);
    const out = await getPendingBannersAfterSweep('app', 'gm-1');
    expect(setBannerStatus).toHaveBeenCalledWith(3595, 'acknowledged');
    expect(out).toEqual([]);
    expect(getPendingBanners).toHaveBeenCalledTimes(2);
  });
});
