import { describe, it, expect } from 'vitest';
import {
  PRE_ROLL_MODE_ACTION,
  PRE_ROLL_MODE_PRIVATE,
  PRE_ROLL_MODE_PRIVATE_WITH,
  PRE_ROLL_MODE_GROUP,
  PRE_ROLL_MODE_TAG_TEAM,
  applyPreRollMode,
  listPreRollModeOptions,
  preRollModeLabel,
  resolvePreRollMode,
} from '../../src/client/lib/pre-roll-mode.js';
import {
  ROLL_VISIBILITY_TABLE,
  ROLL_VISIBILITY_GM_AND_PLAYER,
  ROLL_VISIBILITY_GM_ONLY,
} from '../../src/client/lib/roll-visibility.js';

const assigned = {
  instanceId: 'ada',
  assignedPlayerUid: 'player-a',
  assignedPlayerEmail: 'a@example.com',
  playerName: 'Ada',
};

describe('resolvePreRollMode / applyPreRollMode', () => {
  it('prefers Tag Team then Group over visibility', () => {
    expect(resolvePreRollMode({
      tagTeam: true,
      groupRoll: true,
      visibility: ROLL_VISIBILITY_GM_ONLY,
    })).toBe(PRE_ROLL_MODE_TAG_TEAM);
    expect(resolvePreRollMode({
      groupRoll: true,
      visibility: ROLL_VISIBILITY_GM_ONLY,
    })).toBe(PRE_ROLL_MODE_GROUP);
  });

  it('maps Private vs Private with by role', () => {
    expect(resolvePreRollMode({ visibility: ROLL_VISIBILITY_GM_ONLY })).toBe(PRE_ROLL_MODE_PRIVATE);
    expect(resolvePreRollMode({
      visibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      isPlayer: false,
    })).toBe(PRE_ROLL_MODE_PRIVATE_WITH);
    expect(resolvePreRollMode({
      visibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      isPlayer: true,
    })).toBe(PRE_ROLL_MODE_PRIVATE);
    expect(resolvePreRollMode({ visibility: ROLL_VISIBILITY_TABLE })).toBe(PRE_ROLL_MODE_ACTION);
  });

  it('applies mutually exclusive visibility + group + tag team', () => {
    expect(applyPreRollMode(PRE_ROLL_MODE_ACTION)).toEqual({
      visibility: ROLL_VISIBILITY_TABLE,
      groupRoll: false,
      tagTeam: false,
    });
    expect(applyPreRollMode(PRE_ROLL_MODE_PRIVATE, { isPlayer: false })).toEqual({
      visibility: ROLL_VISIBILITY_GM_ONLY,
      groupRoll: false,
      tagTeam: false,
    });
    expect(applyPreRollMode(PRE_ROLL_MODE_PRIVATE, { isPlayer: true })).toEqual({
      visibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      groupRoll: false,
      tagTeam: false,
    });
    expect(applyPreRollMode(PRE_ROLL_MODE_PRIVATE_WITH)).toEqual({
      visibility: ROLL_VISIBILITY_GM_AND_PLAYER,
      groupRoll: false,
      tagTeam: false,
    });
    expect(applyPreRollMode(PRE_ROLL_MODE_GROUP)).toEqual({
      visibility: ROLL_VISIBILITY_TABLE,
      groupRoll: true,
      tagTeam: false,
    });
    expect(applyPreRollMode(PRE_ROLL_MODE_TAG_TEAM)).toEqual({
      visibility: ROLL_VISIBILITY_TABLE,
      groupRoll: false,
      tagTeam: true,
    });
  });
});

describe('listPreRollModeOptions', () => {
  it('includes Private with only for the GM when a player is assigned', () => {
    const gm = listPreRollModeOptions({
      isPlayer: false,
      characterEl: assigned,
      canGroup: true,
      canTagTeam: true,
    });
    expect(gm.map((o) => o.id)).toEqual([
      PRE_ROLL_MODE_ACTION,
      PRE_ROLL_MODE_PRIVATE,
      PRE_ROLL_MODE_PRIVATE_WITH,
      PRE_ROLL_MODE_GROUP,
      PRE_ROLL_MODE_TAG_TEAM,
    ]);
    expect(gm.find((o) => o.id === PRE_ROLL_MODE_PRIVATE_WITH)?.label).toBe('Private with Ada');

    const player = listPreRollModeOptions({
      isPlayer: true,
      characterEl: assigned,
      canGroup: true,
      canTagTeam: true,
    });
    expect(player.map((o) => o.id)).toEqual([
      PRE_ROLL_MODE_ACTION,
      PRE_ROLL_MODE_PRIVATE,
      PRE_ROLL_MODE_GROUP,
      PRE_ROLL_MODE_TAG_TEAM,
    ]);
  });

  it('keeps Tag Team listed while on even if newly disabled', () => {
    const opts = listPreRollModeOptions({
      canTagTeam: false,
      tagTeamOn: true,
      tagTeamDisabledReason: 'Need 3 Hope',
    });
    const tag = opts.find((o) => o.id === PRE_ROLL_MODE_TAG_TEAM);
    expect(tag).toBeTruthy();
    expect(tag.disabled).toBe(false);
  });
});

describe('preRollModeLabel', () => {
  it('uses the short Private labels', () => {
    expect(preRollModeLabel(PRE_ROLL_MODE_PRIVATE)).toBe('Private');
    expect(preRollModeLabel(PRE_ROLL_MODE_PRIVATE_WITH, { assignedPlayerName: 'Ada' }))
      .toBe('Private with Ada');
    expect(preRollModeLabel(PRE_ROLL_MODE_TAG_TEAM)).toBe('Tag Team');
  });
});
