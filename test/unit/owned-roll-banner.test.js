import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  collectBannerIdsByIntentField,
  collectLiveIntentIds,
  collectReactionCallChildBannerIds,
  isOrphanedOwnedBanner,
  isOwnedBannerParentLive,
  isParentOwnedResultBanner,
  planOrphanedOwnedBannerSweep,
  readKeepTagTeamBannersFlag,
  shouldHideOwnedBannerDismiss,
} from '../../src/client/lib/owned-roll-banner.js';

const dir = dirname(fileURLToPath(import.meta.url));

const groupChild = {
  _rollDbId: 3595,
  _isReaction: true,
  _groupRollIntentId: 'int-dead',
  displayName: 'Shamuj — Reaction (Presence)',
};
const reactionChild = {
  _rollDbId: 20,
  _isReaction: true,
  _reactionCallRollDbId: 9,
};
const reactionMarquee = {
  _rollDbId: 9,
  _reactionCall: true,
  _action: true,
};
const tagPartner = {
  _rollDbId: 31,
  _tagTeamIntentId: 'tt-1',
  _tagTeamRole: 'partner',
};
const tagInitiator = {
  _rollDbId: 32,
  _tagTeamIntentId: 'tt-1',
  _tagTeamRole: 'initiator',
};

describe('isParentOwnedResultBanner', () => {
  it('matches group, reaction-call, and unchosen tag-team children', () => {
    expect(isParentOwnedResultBanner(groupChild)).toBe(true);
    expect(isParentOwnedResultBanner(reactionChild)).toBe(true);
    expect(isParentOwnedResultBanner(tagPartner)).toBe(true);
    expect(isParentOwnedResultBanner({ _tagTeamIntentId: 'tt-1', _tagTeamChosen: true })).toBe(false);
    expect(isParentOwnedResultBanner({ total: 12 })).toBe(false);
  });
});

describe('collectLiveIntentIds / collectBannerIdsByIntentField', () => {
  it('reads intent ids from a Map of table sessions', () => {
    const map = new Map([
      ['table-a', { intentId: 'int-1' }],
      ['table-b', { intentId: 'int-2' }],
      ['table-c', {}],
    ]);
    expect(collectLiveIntentIds(map).sort()).toEqual(['int-1', 'int-2']);
  });

  it('collects leftover banners for one group-roll intent', () => {
    expect(collectBannerIdsByIntentField(
      [groupChild, { _rollDbId: 2, _groupRollIntentId: 'other' }],
      '_groupRollIntentId',
      'int-dead',
    )).toEqual([3595]);
  });
});

describe('reaction-call children', () => {
  it('finds pending sub-rolls by marquee id', () => {
    expect(collectReactionCallChildBannerIds(
      [reactionMarquee, reactionChild, { _rollDbId: 21, _reactionCallRollDbId: 8 }],
      9,
    )).toEqual([20]);
  });
});

describe('orphan vs live parent', () => {
  it('treats a group-roll collaborator banner as orphaned when the intent is gone', () => {
    expect(isOwnedBannerParentLive(groupChild, { liveIntentIds: [] })).toBe(false);
    expect(isOrphanedOwnedBanner(groupChild, { liveIntentIds: [] })).toBe(true);
    expect(shouldHideOwnedBannerDismiss(groupChild, { liveIntentIds: [] })).toBe(false);
    expect(shouldHideOwnedBannerDismiss(groupChild, { liveIntentIds: ['int-dead'] })).toBe(true);
  });

  it('treats a reaction sub-roll as orphaned when the marquee is gone', () => {
    expect(shouldHideOwnedBannerDismiss(reactionChild, {
      pendingBanners: [reactionChild],
    })).toBe(false);
    expect(shouldHideOwnedBannerDismiss(reactionChild, {
      pendingBanners: [reactionMarquee, reactionChild],
    })).toBe(true);
  });

  it('keeps Tag Team dismiss locked after Proceed when both banners remain', () => {
    const ctx = {
      liveIntentIds: [],
      pendingBanners: [tagPartner, tagInitiator],
    };
    expect(shouldHideOwnedBannerDismiss(tagPartner, ctx)).toBe(true);
    expect(isOrphanedOwnedBanner(tagPartner, ctx)).toBe(false);
  });

  it('unlocks a lone Tag Team banner after the intent dies', () => {
    expect(shouldHideOwnedBannerDismiss(tagPartner, {
      liveIntentIds: [],
      pendingBanners: [tagPartner],
    })).toBe(false);
  });
});

describe('planOrphanedOwnedBannerSweep', () => {
  it('acks group leftovers whose intent is not live', () => {
    const plan = planOrphanedOwnedBannerSweep(
      [groupChild, { _rollDbId: 4, _groupRollIntentId: 'int-live' }],
      ['int-live'],
    );
    expect(plan.groupAckIds).toEqual([3595]);
    expect(plan.tagTeamCancelIds).toEqual([]);
  });

  it('does not auto-cancel a lone Tag Team leftover (initiator Proceed race)', () => {
    const incomplete = planOrphanedOwnedBannerSweep([tagPartner], []);
    expect(incomplete.tagTeamCancelIds).toEqual([]);
    expect(incomplete.groupAckIds).toEqual([]);

    const pair = planOrphanedOwnedBannerSweep([tagPartner, tagInitiator], []);
    expect(pair.tagTeamCancelIds).toEqual([]);
  });
});

describe('readKeepTagTeamBannersFlag', () => {
  it('accepts body or query so DELETE still keeps banners if the body is dropped', () => {
    expect(readKeepTagTeamBannersFlag({ keepTagTeamBanners: true }, {})).toBe(true);
    expect(readKeepTagTeamBannersFlag({}, { keepTagTeamBanners: '1' })).toBe(true);
    expect(readKeepTagTeamBannersFlag({}, {})).toBe(false);
  });
});

describe('owned-banner wiring', () => {
  it('DiceRoller hides dismiss only while shouldHideOwnedBannerDismiss is true', () => {
    const src = readFileSync(join(dir, '../../src/client/components/DiceRoller.jsx'), 'utf8');
    expect(src).toMatch(/shouldLockOwnedBannerDismiss/);
    expect(src).toMatch(/ownedDismissLocked/);
    expect(src).toMatch(/shouldHideOwnedBannerDismiss\(entry\.roll/);
  });

  it('GMTableView passes live intent ids into the lock predicate', () => {
    const src = readFileSync(join(dir, '../../src/client/components/GMTableView.jsx'), 'utf8');
    expect(src).toMatch(/shouldLockOwnedBannerDismiss=\{\(roll\) => shouldHideOwnedBannerDismiss\(roll/);
    expect(src).toMatch(/pendingIntent\?\.intentId/);
    expect(src).toMatch(/shouldHideTagTeamInitiatorPreRoll/);
    expect(src).not.toMatch(/clearTableIntent\(tableId, banner\.intentId, \{ keepTagTeamBanners: true \}\)/);
  });

  it('banner-ack cascades reaction-call children and DELETE /intent 409 sweeps leftovers', () => {
    const src = readFileSync(join(dir, '../../server.js'), 'utf8');
    expect(src).toMatch(/collectReactionCallChildBannerIds\(pending, row\.id/);
    expect(src).toMatch(/sweepOrphanedOwnedBanners\(APP_ID, ctx\.gmUid\)/);
    expect(src).toMatch(/function stampTagTeamResultOnIntent/);
    expect(src).toMatch(/tagTeamSessionComplete\(updated\)/);
  });
});

