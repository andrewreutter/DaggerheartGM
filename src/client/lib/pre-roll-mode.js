/**
 * Mutually exclusive pre-roll mode: Action / Private / Private with / Group / Tag Team.
 * Visibility, Group, and Tag Team are one selector rather than a dropdown plus checkboxes.
 */

import {
  ROLL_VISIBILITY_TABLE,
  ROLL_VISIBILITY_GM_AND_PLAYER,
  ROLL_VISIBILITY_GM_ONLY,
  characterHasAssignedPlayer,
  assignedPlayerDisplayName,
} from './roll-visibility.js';

export const PRE_ROLL_MODE_ACTION = 'action';
export const PRE_ROLL_MODE_PRIVATE = 'private';
export const PRE_ROLL_MODE_PRIVATE_WITH = 'private_with';
export const PRE_ROLL_MODE_GROUP = 'group';
export const PRE_ROLL_MODE_TAG_TEAM = 'tag_team';

/**
 * @param {{
 *   visibility?: string | null,
 *   groupRoll?: boolean,
 *   tagTeam?: boolean,
 *   isPlayer?: boolean,
 * }} args
 * @returns {string}
 */
export function resolvePreRollMode({
  visibility = ROLL_VISIBILITY_TABLE,
  groupRoll = false,
  tagTeam = false,
  isPlayer = false,
} = {}) {
  if (tagTeam) return PRE_ROLL_MODE_TAG_TEAM;
  if (groupRoll) return PRE_ROLL_MODE_GROUP;
  if (visibility === ROLL_VISIBILITY_GM_ONLY) return PRE_ROLL_MODE_PRIVATE;
  if (visibility === ROLL_VISIBILITY_GM_AND_PLAYER) {
    return isPlayer ? PRE_ROLL_MODE_PRIVATE : PRE_ROLL_MODE_PRIVATE_WITH;
  }
  return PRE_ROLL_MODE_ACTION;
}

/**
 * @param {string} mode
 * @param {{ isPlayer?: boolean }} [opts]
 * @returns {{
 *   visibility: string,
 *   groupRoll: boolean,
 *   tagTeam: boolean,
 * }}
 */
export function applyPreRollMode(mode, { isPlayer = false } = {}) {
  switch (mode) {
    case PRE_ROLL_MODE_PRIVATE:
      return {
        visibility: isPlayer ? ROLL_VISIBILITY_GM_AND_PLAYER : ROLL_VISIBILITY_GM_ONLY,
        groupRoll: false,
        tagTeam: false,
      };
    case PRE_ROLL_MODE_PRIVATE_WITH:
      return {
        visibility: ROLL_VISIBILITY_GM_AND_PLAYER,
        groupRoll: false,
        tagTeam: false,
      };
    case PRE_ROLL_MODE_GROUP:
      return {
        visibility: ROLL_VISIBILITY_TABLE,
        groupRoll: true,
        tagTeam: false,
      };
    case PRE_ROLL_MODE_TAG_TEAM:
      return {
        visibility: ROLL_VISIBILITY_TABLE,
        groupRoll: false,
        tagTeam: true,
      };
    default:
      return {
        visibility: ROLL_VISIBILITY_TABLE,
        groupRoll: false,
        tagTeam: false,
      };
  }
}

/**
 * @param {{
 *   isPlayer?: boolean,
 *   characterEl?: object | null,
 *   joinedPlayers?: object[],
 *   canGroup?: boolean,
 *   canTagTeam?: boolean,
 *   tagTeamOn?: boolean,
 *   tagTeamDisabledReason?: string,
 *   tagTeamHopeCost?: number,
 * }} args
 * @returns {{
 *   id: string,
 *   label: string,
 *   testId: string,
 *   disabled?: boolean,
 *   title?: string,
 * }[]}
 */
export function listPreRollModeOptions({
  isPlayer = false,
  characterEl = null,
  joinedPlayers = [],
  canGroup = false,
  canTagTeam = false,
  tagTeamOn = false,
  tagTeamDisabledReason = '',
  tagTeamHopeCost = 3,
} = {}) {
  const options = [
    { id: PRE_ROLL_MODE_ACTION, label: 'Action', testId: 'preroll-mode-action' },
    { id: PRE_ROLL_MODE_PRIVATE, label: 'Private', testId: 'preroll-mode-private' },
  ];
  if (!isPlayer && characterHasAssignedPlayer(characterEl)) {
    const name = assignedPlayerDisplayName(characterEl, joinedPlayers) || 'player';
    options.push({
      id: PRE_ROLL_MODE_PRIVATE_WITH,
      label: `Private with ${name}`,
      testId: 'preroll-mode-private-with',
    });
  }
  if (canGroup) {
    options.push({
      id: PRE_ROLL_MODE_GROUP,
      label: 'Group Roll',
      testId: 'preroll-group-roll',
    });
  }
  if (canTagTeam || tagTeamOn) {
    const disabled = !!tagTeamDisabledReason && !tagTeamOn;
    options.push({
      id: PRE_ROLL_MODE_TAG_TEAM,
      label: 'Tag Team',
      testId: 'preroll-tag-team',
      disabled,
      title: disabled
        ? tagTeamDisabledReason
        : `Spend ${tagTeamHopeCost} Hope`,
    });
  }
  return options;
}

/**
 * Observer / read-only label for the selected mode.
 * @param {string} mode
 * @param {{ assignedPlayerName?: string | null }} [opts]
 * @returns {string}
 */
export function preRollModeLabel(mode, { assignedPlayerName = null } = {}) {
  switch (mode) {
    case PRE_ROLL_MODE_PRIVATE:
      return 'Private';
    case PRE_ROLL_MODE_PRIVATE_WITH:
      return assignedPlayerName ? `Private with ${assignedPlayerName}` : 'Private';
    case PRE_ROLL_MODE_GROUP:
      return 'Group Roll';
    case PRE_ROLL_MODE_TAG_TEAM:
      return 'Tag Team';
    default:
      return 'Action';
  }
}
