import { describe, it, expect } from 'vitest';
import {
  ROLL_VISIBILITY_TABLE,
  ROLL_VISIBILITY_GM_AND_PLAYER,
  ROLL_VISIBILITY_GM_ONLY,
  canViewerSeeRoll,
  canViewerSeeIntent,
  filterRollsForViewer,
  bannerViewerCacheKey,
  normalizePostedRollVisibility,
  stampNormalizedRollVisibility,
  isRestrictedRollVisibility,
  characterHasAssignedPlayer,
  assignedPlayerDisplayName,
} from '../../src/client/lib/roll-visibility.js';

const GM = { role: 'gm', uid: 'gm-1', email: 'gm@example.com' };
const PLAYER_A = { role: 'player', uid: 'player-a', email: 'a@example.com' };
const PLAYER_B = { role: 'player', uid: 'player-b', email: 'b@example.com' };
const SPECTATOR = { role: 'spectator', uid: 'spec-1', email: 'spec@example.com' };

describe('canViewerSeeRoll', () => {
  it('table / omitted is visible to everyone', () => {
    expect(canViewerSeeRoll({ displayName: 'Public' }, PLAYER_B)).toBe(true);
    expect(canViewerSeeRoll({ _rollVisibility: 'table' }, SPECTATOR)).toBe(true);
    expect(canViewerSeeRoll({ _rollVisibility: 'nope' }, PLAYER_B)).toBe(true);
  });

  it('gm_only is visible only to the GM', () => {
    const roll = { _rollVisibility: ROLL_VISIBILITY_GM_ONLY };
    expect(canViewerSeeRoll(roll, GM)).toBe(true);
    expect(canViewerSeeRoll(roll, PLAYER_A)).toBe(false);
    expect(canViewerSeeRoll(roll, SPECTATOR)).toBe(false);
    expect(canViewerSeeRoll(roll, {})).toBe(false);
  });

  it('gm_and_player matches included player by uid or email', () => {
    const byUid = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: 'player-a',
    };
    expect(canViewerSeeRoll(byUid, GM)).toBe(true);
    expect(canViewerSeeRoll(byUid, PLAYER_A)).toBe(true);
    expect(canViewerSeeRoll(byUid, PLAYER_B)).toBe(false);
    expect(canViewerSeeRoll(byUid, SPECTATOR)).toBe(false);

    const byEmail = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerEmail: 'A@Example.com',
    };
    expect(canViewerSeeRoll(byEmail, { role: 'player', uid: 'other', email: 'a@example.com' })).toBe(true);
    expect(canViewerSeeRoll(byEmail, PLAYER_B)).toBe(false);
  });

  it('gm_and_player falls back to _initiatorUid when visibility player is omitted', () => {
    const roll = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _initiatorUid: 'player-a',
    };
    expect(canViewerSeeRoll(roll, PLAYER_A)).toBe(true);
    expect(canViewerSeeRoll(roll, PLAYER_B)).toBe(false);
  });

  it('gm_and_player with _visibilityPlayerEmails array allows any listed player', () => {
    const roll = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerEmail: 'a@example.com',
      _visibilityPlayerEmails: ['a@example.com', 'b@example.com'],
    };
    expect(canViewerSeeRoll(roll, PLAYER_A)).toBe(true);
    expect(canViewerSeeRoll(roll, PLAYER_B)).toBe(true);
    expect(canViewerSeeRoll(roll, { role: 'player', uid: 'other', email: 'c@example.com' })).toBe(false);
  });
});

describe('canViewerSeeIntent', () => {
  it('null intent (clear) is deliverable to everyone', () => {
    expect(canViewerSeeIntent(null, PLAYER_B)).toBe(true);
  });

  it('table-visible intent is delivered to GM, invited players, and audience', () => {
    const intent = {
      _rollVisibility: ROLL_VISIBILITY_TABLE,
      _initiatorUid: 'player-a',
      _initiatorEmail: 'a@example.com',
    };
    expect(canViewerSeeIntent(intent, GM)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_A)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_B)).toBe(true);
    expect(canViewerSeeIntent(intent, SPECTATOR)).toBe(true);
  });

  it('omitted visibility defaults to table (audience included)', () => {
    const intent = { _initiatorUid: 'player-a', _initiatorEmail: 'a@example.com' };
    expect(canViewerSeeIntent(intent, PLAYER_B)).toBe(true);
    expect(canViewerSeeIntent(intent, SPECTATOR)).toBe(true);
  });

  it('private-to-player intent is GM + initiator / assigned only', () => {
    const intent = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _initiatorUid: 'player-a',
      _initiatorEmail: 'a@example.com',
      _assignedPlayerEmails: ['a@example.com'],
      _assignedPlayerUid: 'player-a',
    };
    expect(canViewerSeeIntent(intent, GM)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_A)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_B)).toBe(false);
    expect(canViewerSeeIntent(intent, SPECTATOR)).toBe(false);
  });

  it('gm-only intent is GM only', () => {
    const intent = {
      _rollVisibility: ROLL_VISIBILITY_GM_ONLY,
      _initiatorUid: 'player-a',
      _initiatorEmail: 'a@example.com',
      _assignedPlayerEmails: ['a@example.com'],
      _assignedPlayerUid: 'player-a',
    };
    expect(canViewerSeeIntent(intent, GM)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_A)).toBe(false);
    expect(canViewerSeeIntent(intent, PLAYER_B)).toBe(false);
    expect(canViewerSeeIntent(intent, SPECTATOR)).toBe(false);
  });

  it('shows a GM-opened private session to the assigned player', () => {
    const intent = {
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _initiatorUid: 'gm-uid',
      _initiatorEmail: 'gm@example.com',
      _assignedPlayerEmails: ['a@example.com'],
      _assignedPlayerUid: 'player-a',
    };
    expect(canViewerSeeIntent(intent, PLAYER_A)).toBe(true);
    expect(canViewerSeeIntent(intent, PLAYER_B)).toBe(false);
    expect(canViewerSeeIntent(intent, SPECTATOR)).toBe(false);
  });
});

describe('filterRollsForViewer', () => {
  const publicRoll = { _rollDbId: 1, displayName: 'Public' };
  const privateA = {
    _rollDbId: 2,
    displayName: 'Private A',
    _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
    _visibilityPlayerUid: 'player-a',
  };
  const blind = {
    _rollDbId: 3,
    displayName: 'Blind',
    _rollVisibility: ROLL_VISIBILITY_GM_ONLY,
  };

  it('GM sees every roll; player A omits B-blind and other-player private', () => {
    const rolls = [publicRoll, privateA, blind];
    expect(filterRollsForViewer(rolls, GM).map((r) => r._rollDbId)).toEqual([1, 2, 3]);
    expect(filterRollsForViewer(rolls, PLAYER_A).map((r) => r._rollDbId)).toEqual([1, 2]);
    expect(filterRollsForViewer(rolls, PLAYER_B).map((r) => r._rollDbId)).toEqual([1]);
    expect(filterRollsForViewer(rolls, SPECTATOR).map((r) => r._rollDbId)).toEqual([1]);
  });

  it('returns [] for a non-array', () => {
    expect(filterRollsForViewer(null, GM)).toEqual([]);
  });
});

describe('bannerViewerCacheKey', () => {
  it('maps role to gm / spectator / player:uid', () => {
    expect(bannerViewerCacheKey(GM)).toBe('gm');
    expect(bannerViewerCacheKey(SPECTATOR)).toBe('spectator');
    expect(bannerViewerCacheKey(null)).toBe('spectator');
    expect(bannerViewerCacheKey(PLAYER_A)).toBe('player:player-a');
    expect(bannerViewerCacheKey({ role: 'player', email: 'a@example.com' })).toBe('player:a@example.com');
  });
});

describe('normalizePostedRollVisibility', () => {
  it('player may only set table or gm_and_player as themselves', () => {
    expect(normalizePostedRollVisibility({
      requestedVisibility: 'table',
      isGm: false,
      requesterUid: 'player-a',
      requesterEmail: 'a@example.com',
    })).toEqual({ _rollVisibility: ROLL_VISIBILITY_TABLE });

    expect(normalizePostedRollVisibility({
      requestedVisibility: 'gm_and_player',
      isGm: false,
      requesterUid: 'player-a',
      requesterEmail: 'a@example.com',
      assignedPlayerUid: 'someone-else',
    })).toEqual({
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: 'player-a',
      _visibilityPlayerEmail: 'a@example.com',
    });

    expect(normalizePostedRollVisibility({
      requestedVisibility: 'gm_only',
      isGm: false,
      requesterUid: 'player-a',
      requesterEmail: 'a@example.com',
    })).toEqual({
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: 'player-a',
      _visibilityPlayerEmail: 'a@example.com',
    });
  });

  it('GM gm_and_player without an assigned player coerces to gm_only', () => {
    expect(normalizePostedRollVisibility({
      requestedVisibility: 'gm_and_player',
      isGm: true,
    })).toEqual({ _rollVisibility: ROLL_VISIBILITY_GM_ONLY });

    expect(normalizePostedRollVisibility({
      requestedVisibility: 'gm_and_player',
      isGm: true,
      assignedPlayerUid: 'player-a',
      assignedPlayerEmail: 'a@example.com',
    })).toEqual({
      _rollVisibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      _visibilityPlayerUid: 'player-a',
      _visibilityPlayerEmail: 'a@example.com',
    });
  });

  it('GM gm_and_player with multiple assignees stamps _visibilityPlayerEmails', () => {
    const result = normalizePostedRollVisibility({
      requestedVisibility: 'gm_and_player',
      isGm: true,
      assignedPlayerUid: 'player-a',
      assignedPlayerEmail: 'a@example.com',
      assignedPlayerEmails: ['a@example.com', 'b@example.com'],
    });
    expect(result._rollVisibility).toBe(ROLL_VISIBILITY_GM_AND_PLAYER);
    expect(result._visibilityPlayerEmail).toBe('a@example.com');
    expect(result._visibilityPlayerEmails).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('stampNormalizedRollVisibility', () => {
  it('strips client-supplied visibility fields when the request is table / omitted', () => {
    const roll = {
      total: 12,
      _rollVisibility: 'gm_only',
      _visibilityPlayerUid: 'forged',
      _visibilityPlayerEmail: 'forged@example.com',
    };
    stampNormalizedRollVisibility(roll, { requestedVisibility: 'table', isGm: false });
    expect(roll._rollVisibility).toBeUndefined();
    expect(roll._visibilityPlayerUid).toBeUndefined();
    expect(roll._visibilityPlayerEmail).toBeUndefined();
  });

  it('stamps player private onto the roll', () => {
    const roll = { total: 8 };
    stampNormalizedRollVisibility(roll, {
      requestedVisibility: 'gm_and_player',
      isGm: false,
      requesterUid: 'player-a',
      requesterEmail: 'a@example.com',
    });
    expect(roll._rollVisibility).toBe(ROLL_VISIBILITY_GM_AND_PLAYER);
    expect(roll._visibilityPlayerUid).toBe('player-a');
    expect(roll._visibilityPlayerEmail).toBe('a@example.com');
  });
});

describe('assigned player helpers', () => {
  it('isRestrictedRollVisibility', () => {
    expect(isRestrictedRollVisibility('table')).toBe(false);
    expect(isRestrictedRollVisibility('gm_and_player')).toBe(true);
    expect(isRestrictedRollVisibility('gm_only')).toBe(true);
  });

  it('assignedPlayerDisplayName prefers roster name then playerName then email', () => {
    expect(characterHasAssignedPlayer({})).toBe(false);
    expect(assignedPlayerDisplayName({ assignedPlayerEmail: 'a@example.com' }, [
      { email: 'a@example.com', name: 'Avery' },
    ])).toBe('Avery');
    expect(assignedPlayerDisplayName({
      assignedPlayerEmail: 'a@example.com',
      playerName: 'Sheet Name',
    }, [])).toBe('Sheet Name');
    expect(assignedPlayerDisplayName({ assignedPlayerEmail: 'a@example.com' }, [])).toBe('a@example.com');
    expect(assignedPlayerDisplayName({}, [])).toBe(null);
  });
});
