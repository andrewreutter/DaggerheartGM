/**
 * Map-chrome tooltip copy for Players / Characters / Encounter sidebar cards.
 * Hover (desktop) replaces the Game Map tooltip; click still opens the card.
 */

import { GM_TOKEN_HOVER_HINT_CONTENT_LINES } from './token-overlay-activate.js';

function clickVerb(isTouch) {
  return isTouch ? 'Tap' : 'Click';
}

/** Vanilla open/close line — renderer adds space before more specific items. */
export function chromeLead(text) {
  return { text, role: 'lead' };
}

/** One function icon + its explanation (one icon per row). Optional `legend` groups side-by-side blocks. */
export function chromeAction(icon, text, extras = {}) {
  const out = { text, icon };
  if (extras.legend) out.legend = extras.legend;
  return out;
}

/** Hope / Armor / HP / Stress — same icons and card order as CheckboxTrack. */
export const CHARACTER_RESOURCE_LEGEND_LINES = [
  chromeAction('hope', 'Hope', { legend: 'resources' }),
  chromeAction('armor', 'Armor', { legend: 'resources' }),
  chromeAction('hp', 'HP', { legend: 'resources' }),
  chromeAction('stress', 'Stress', { legend: 'resources' }),
];

/** HP / Stress — adversary cards have no Hope or Armor tracks. */
export const ADVERSARY_RESOURCE_LEGEND_LINES = [
  chromeAction('hp', 'HP', { legend: 'resources' }),
  chromeAction('stress', 'Stress', { legend: 'resources' }),
];

/**
 * @param {string} kind
 * @param {object} [payload]
 * @param {{ isPlayer?: boolean, isTouch?: boolean, isMyCharacter?: boolean }} [opts]
 * @returns {{ id: string, title: string, lines: Array<string|{ text: string, icon?: string, role?: string }> }|null}
 */
export function tablePanelHoverHintModel(kind, payload = {}, {
  isPlayer = false,
  isTouch = false,
  isMyCharacter = false,
} = {}) {
  const click = clickVerb(isTouch);
  switch (kind) {
    case 'support-table':
      return {
        id: 'support-table',
        title: 'Support this table',
        lines: [`${click} to gift a Campaign Pass so this table stays live.`],
      };
    case 'invite-link':
      return {
        id: 'invite-link',
        title: 'Invite Link',
        lines: payload.hasLink
          ? [
            'Copy the link to invite players.',
            'Revoke to stop new joins. Anyone already joined stays.',
          ]
          : [`${click} to create a join link. Anyone who signs in with it joins this table.`],
      };
    case 'player': {
      const name = String(payload.name || '').trim() || 'Player';
      const email = String(payload.email || '').trim();
      return {
        id: email ? `player:${email}` : `player:${name}`,
        title: name,
        lines: isPlayer
          ? [payload.online ? 'Online now.' : 'Not online right now.']
          : [
            chromeAction('eye', 'Preview the table as this player'),
            chromeAction('trash', 'Remove them. They will need a new invite to rejoin.'),
          ],
      };
    }
    case 'audience':
      return {
        id: 'audience',
        title: 'Audience',
        lines: ['Spectators watching this public table. They cannot play or edit.'],
      };
    case 'add-character':
      return {
        id: 'add-character',
        title: 'Add Character',
        lines: [`${click} to create a new character and open the editor.`],
      };
    case 'characters-section': {
      const canAdd = payload.canAdd !== false;
      const lines = [
        chromeLead(`${click} to open a character sheet.`),
        `${click} a track to mark or clear Hope, Armor, HP, or Stress.`,
        ...CHARACTER_RESOURCE_LEGEND_LINES,
      ];
      if (canAdd) {
        lines.push(chromeAction('plus', `${click} to create a new character and open the editor.`, { legend: 'functions' }));
      }
      if (!isPlayer) {
        lines.push(
          chromeAction('users', 'Assign players', { legend: 'functions' }),
          chromeAction('zap', 'Call for Reaction', { legend: 'functions' }),
          chromeAction('trash', 'Remove from the table', { legend: 'functions' }),
        );
      } else {
        lines.push(chromeAction('users', 'See who is assigned', { legend: 'functions' }));
      }
      return {
        id: 'characters-section',
        title: 'Characters',
        lines,
      };
    }
    case 'leave-table':
      return {
        id: 'leave-table',
        title: 'Leave table',
        lines: [`${click} to leave. You will need a new invite link to rejoin.`],
      };
    case 'bug-report':
      return {
        id: 'bug-report',
        title: 'Report a problem',
        lines: [`${click} to send a problem report. Play is not interrupted.`],
      };
    case 'character': {
      const name = String(payload.name || '').trim() || 'Unnamed';
      const lines = [chromeLead(`${click} to open the character sheet.`)];
      if (!isPlayer || isMyCharacter) {
        lines.push(`${click} a track to mark or clear Hope, Armor, HP, or Stress.`);
      }
      lines.push(...CHARACTER_RESOURCE_LEGEND_LINES);
      if (!isPlayer) {
        lines.push(
          chromeAction('users', 'Assign players', { legend: 'functions' }),
          chromeAction('zap', 'Call for Reaction', { legend: 'functions' }),
          chromeAction('trash', 'Remove from the table', { legend: 'functions' }),
        );
      } else if (isMyCharacter) {
        lines.push(chromeAction('users', 'See who is assigned', { legend: 'functions' }));
      }
      return {
        id: payload.instanceId || 'character',
        title: name,
        lines,
      };
    }
    case 'party-loot':
      return {
        id: 'party-loot',
        title: 'Party Loot',
        lines: isPlayer
          ? [`${click} to view shared gold and items.`]
          : [`${click} to open shared gold and items. You can edit; players can view.`],
      };
    case 'start-session':
      return {
        id: 'start-session',
        title: 'Start Session',
        lines: [
          chromeLead(`${click} to start the session.`),
          'Apply the banner to reset session uses and run session-start hooks.',
        ],
      };
    case 'end-session':
      return {
        id: 'end-session',
        title: 'End Session',
        lines: [`${click} to end the session. Play mechanics pause until you start again.`],
      };
    case 'resume-session':
      return {
        id: 'resume-session',
        title: 'Resume Session',
        lines: [`${click} to resume play after the table was idle.`],
      };
    case 'short-rest':
      return {
        id: 'short-rest',
        title: 'Short Rest',
        lines: [
          chromeLead(`${click} to call a short rest.`),
          'Characters pick downtime moves. Apply to add Fear and refresh rest uses.',
        ],
      };
    case 'long-rest':
      return {
        id: 'long-rest',
        title: 'Long Rest',
        lines: [
          chromeLead(`${click} to call a long rest.`),
          'Characters pick downtime moves. Apply to add Fear and refresh rest and long-rest uses.',
        ],
      };
    case 'call-for-reaction':
      return {
        id: 'call-for-reaction',
        title: 'Call for Reaction',
        lines: [
          chromeLead(`${click} to open the reaction panel.`),
          'Choose a default trait, characters, and a Difficulty.',
          'Each selected character can use a different trait.',
        ],
      };
    case 'fear':
      return {
        id: 'fear',
        title: 'Fear',
        lines: isPlayer
          ? ['Fear on the table. The GM marks this track.']
          : [`${click} a pip to gain or spend Fear.`],
      };
    case 'gm-moves':
      return {
        id: 'gm-moves',
        title: 'GM Moves',
        lines: isPlayer
          ? []
          : [
            chromeLead(isTouch ? 'Tap to show or hide.' : 'Click to show or hide.'),
            ...GM_TOKEN_HOVER_HINT_CONTENT_LINES,
          ],
      };
    case 'load-scene':
      return {
        id: 'load-scene',
        title: 'Load Scene',
        lines: [chromeAction('folder', 'Load a scene onto the table')],
      };
    case 'save-scene':
      return {
        id: 'save-scene',
        title: 'Save Scene',
        lines: [chromeAction('camera', 'Save the current table as a scene')],
      };
    case 'clear-table':
      return {
        id: 'clear-table',
        title: 'Clear table',
        lines: [chromeAction('trash', 'Remove all adversaries, environments, and notes')],
      };
    case 'notes-section':
      return {
        id: 'notes-section',
        title: 'Notes',
        lines: isPlayer
          ? ['A note the GM has shared with the table.']
          : [
            chromeLead(`${click} to open a note.`),
            chromeAction('plus', 'Add a note'),
            chromeAction('eye', 'Show to players'),
            chromeAction('eye-off', 'GM only'),
            chromeAction('trash', 'Remove from the table'),
          ],
      };
    case 'add-note':
      return {
        id: 'add-note',
        title: 'Add note',
        lines: [chromeAction('plus', 'Add a note')],
      };
    case 'note': {
      const name = String(payload.name || '').trim() || 'Note';
      const gmOnly = payload.visibility === 'gm';
      return {
        id: payload.instanceId || 'note',
        title: name,
        lines: isPlayer
          ? ['A note the GM has shared with the table.']
          : [
            chromeLead(`${click} to open the note.`),
            chromeAction(gmOnly ? 'eye-off' : 'eye', gmOnly ? 'Show to players' : 'GM only'),
            chromeAction('trash', 'Remove from the table'),
          ],
      };
    }
    case 'countdowns-section':
      return {
        id: 'countdowns-section',
        title: 'Countdowns',
        lines: isPlayer
          ? ['A countdown the GM has shared with the table.']
          : [
            chromeLead(`${click} to open a countdown.`),
            `${click} − or + to change the value.`,
            chromeAction('plus', 'Add a countdown'),
            chromeAction('eye', 'Show to players'),
            chromeAction('eye-off', 'GM only'),
          ],
      };
    case 'add-countdown':
      return {
        id: 'add-countdown',
        title: 'Add countdown',
        lines: [chromeAction('plus', 'Add a countdown')],
      };
    case 'countdown': {
      const name = String(payload.label || payload.name || '').trim() || 'Countdown';
      const gmOnly = payload.visibility === 'gm';
      return {
        id: payload.id || 'countdown',
        title: name,
        lines: isPlayer
          ? ['A countdown the GM has shared with the table.']
          : [
            chromeLead(`${click} to open the countdown.`),
            `${click} − or + to change the value.`,
            chromeAction(gmOnly ? 'eye-off' : 'eye', gmOnly ? 'Show to players' : 'GM only'),
          ],
      };
    }
    case 'environments-section':
      return {
        id: 'environments-section',
        title: 'Environments',
        lines: [
          chromeLead(`${click} to open an environment.`),
          chromeAction('plus', 'Add an environment'),
          chromeAction('trash', payload.removeFromScene ? 'Remove from the scene' : 'Remove from the table'),
        ],
      };
    case 'add-environment':
      return {
        id: 'add-environment',
        title: 'Add environment',
        lines: [chromeAction('plus', 'Add an environment')],
      };
    case 'environment': {
      const name = String(payload.name || '').trim() || 'Environment';
      return {
        id: payload.instanceId || 'environment',
        title: name,
        lines: [
          chromeLead(`${click} to open the environment.`),
          chromeAction('trash', payload.removeFromScene ? 'Remove from the scene' : 'Remove from the table'),
        ],
      };
    }
    case 'adversaries-section': {
      const lines = isPlayer
        ? [
          chromeLead('Wounded or marked adversaries the GM has revealed. Tracks are read-only.'),
          ...ADVERSARY_RESOURCE_LEGEND_LINES,
        ]
        : [
          chromeLead(`${click} to open an adversary.`),
          `${click} a track to mark or clear HP or Stress.`,
          ...ADVERSARY_RESOURCE_LEGEND_LINES,
          chromeAction('plus', 'Add an adversary', { legend: 'functions' }),
          chromeAction('plus', 'Add another copy or minion group', { legend: 'functions' }),
          chromeAction('minus', 'Remove one or last minion group', { legend: 'functions' }),
          chromeAction(
            'trash',
            payload.removeFromScene ? 'Remove from the scene' : 'Remove from the table',
            { legend: 'functions' },
          ),
          chromeAction('tag', 'Add conditions', { legend: 'functions' }),
        ];
      return {
        id: 'adversaries-section',
        title: 'Adversaries',
        lines,
      };
    }
    case 'add-adversary':
      return {
        id: 'add-adversary',
        title: 'Add adversary',
        lines: [chromeAction('plus', 'Add an adversary')],
      };
    case 'adversary': {
      const name = String(payload.name || '').trim() || 'Adversary';
      const isMinion = !!payload.isMinion;
      const last = payload.instanceCount <= 1;
      const lines = isPlayer
        ? [
          chromeLead('Wounded or marked adversaries the GM has revealed. Tracks are read-only.'),
          ...ADVERSARY_RESOURCE_LEGEND_LINES,
        ]
        : [
          chromeLead(`${click} to open the adversary.`),
          `${click} a track to mark or clear HP or Stress.`,
          ...ADVERSARY_RESOURCE_LEGEND_LINES,
          chromeAction('plus', isMinion ? 'Add a minion group' : 'Add another', { legend: 'functions' }),
          chromeAction(
            last ? 'trash' : 'minus',
            last ? (payload.removeFromScene ? 'Remove from the scene' : 'Remove from the table')
              : (isMinion ? 'Remove last group' : 'Remove one'),
            { legend: 'functions' },
          ),
          chromeAction('tag', 'Add conditions', { legend: 'functions' }),
        ];
      return {
        id: payload.id || payload.instanceId || 'adversary',
        title: name,
        lines,
      };
    }
    case 'bp-budget':
      return {
        id: 'bp-budget',
        title: 'BP Budget',
        lines: [
          chromeLead(`${click} to expand battle-point budget and difficulty factors.`),
          'Spend vs the party budget. Auto-detected and chosen factors change the total.',
        ],
      };
    default:
      return null;
  }
}

/**
 * Mouse-enter / leave props that publish a hint into map chrome tooltip state.
 * @param {(hint: { id: string, title: string, lines: object[] }|null|((prev: object|null) => object|null)) => void} setHint
 * @param {{ id?: string, title?: string, lines?: object[] }|null|undefined} hint
 */
export function tablePanelChromeHoverProps(setHint, hint) {
  if (!hint?.title || typeof setHint !== 'function') return {};
  return {
    onMouseEnter: () => setHint(hint),
    onMouseLeave: () => setHint((prev) => (prev?.id === hint.id ? null : prev)),
  };
}
