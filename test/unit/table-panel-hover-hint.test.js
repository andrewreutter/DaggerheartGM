import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ADVERSARY_RESOURCE_LEGEND_LINES,
  CHARACTER_RESOURCE_LEGEND_LINES,
  tablePanelChromeHoverProps,
  tablePanelHoverHintModel,
} from '../../src/client/lib/table-panel-hover-hint.js';
import { chromeTooltipLineText } from '../../src/client/lib/map-hover-hint.js';

const dir = dirname(fileURLToPath(import.meta.url));

describe('tablePanelHoverHintModel', () => {
  it('titles each Players / Characters card and documents click vs tap', () => {
    expect(tablePanelHoverHintModel('support-table').title).toBe('Support this table');
    expect(tablePanelHoverHintModel('invite-link').lines[0]).toContain('Click to create a join link');
    expect(tablePanelHoverHintModel('invite-link', {}, { isTouch: true }).lines[0]).toContain('Tap to create a join link');
    expect(tablePanelHoverHintModel('invite-link', { hasLink: true }).lines).toEqual([
      'Copy the link to invite players.',
      'Revoke to stop new joins. Anyone already joined stays.',
    ]);
    expect(tablePanelHoverHintModel('add-character').title).toBe('Add Character');
    expect(tablePanelHoverHintModel('party-loot').title).toBe('Party Loot');
    expect(tablePanelHoverHintModel('leave-table').id).toBe('leave-table');
    expect(tablePanelHoverHintModel('bug-report').lines[0]).toContain('Play is not interrupted');
    expect(tablePanelHoverHintModel('audience').lines[0]).toContain('cannot play or edit');
    expect(tablePanelHoverHintModel('unknown')).toBeNull();
  });

  it('combines character add + card actions on the Characters section', () => {
    const gm = tablePanelHoverHintModel('characters-section');
    expect(gm).toEqual({
      id: 'characters-section',
      title: 'Characters',
      lines: [
        { text: 'Click to open a character sheet.', role: 'lead' },
        'Click a track to mark or clear Hope, Armor, HP, or Stress.',
        ...CHARACTER_RESOURCE_LEGEND_LINES,
        { text: 'Click to create a new character and open the editor.', icon: 'plus', legend: 'functions' },
        { text: 'Assign players', icon: 'users', legend: 'functions' },
        { text: 'Call for Reaction', icon: 'zap', legend: 'functions' },
        { text: 'Remove from the table', icon: 'trash', legend: 'functions' },
      ],
    });

    const player = tablePanelHoverHintModel('characters-section', {}, { isPlayer: true });
    expect(player.lines).toEqual([
      { text: 'Click to open a character sheet.', role: 'lead' },
      'Click a track to mark or clear Hope, Armor, HP, or Stress.',
      ...CHARACTER_RESOURCE_LEGEND_LINES,
      { text: 'Click to create a new character and open the editor.', icon: 'plus', legend: 'functions' },
      { text: 'See who is assigned', icon: 'users', legend: 'functions' },
    ]);

    const spectator = tablePanelHoverHintModel('characters-section', { canAdd: false }, { isPlayer: true });
    expect(spectator.lines.some((line) => typeof line === 'object' && line.icon === 'plus')).toBe(false);
  });

  it('documents GM player-row actions and player online status', () => {
    const gm = tablePanelHoverHintModel('player', { name: 'Sam', email: 'sam@x.test', online: true });
    expect(gm.id).toBe('player:sam@x.test');
    expect(gm.title).toBe('Sam');
    expect(gm.lines).toEqual([
      { text: 'Preview the table as this player', icon: 'eye' },
      { text: 'Remove them. They will need a new invite to rejoin.', icon: 'trash' },
    ]);
    expect(tablePanelHoverHintModel(
      'player',
      { name: 'Sam', email: 'sam@x.test', online: true },
      { isPlayer: true },
    ).lines).toEqual(['Online now.']);
    expect(tablePanelHoverHintModel(
      'player',
      { name: 'Sam', email: 'sam@x.test', online: false },
      { isPlayer: true },
    ).lines).toEqual(['Not online right now.']);
  });
});

describe('tablePanelChromeHoverProps', () => {
  it('publishes the hint on enter and clears only that hint on leave', () => {
    const setHint = vi.fn();
    const hint = tablePanelHoverHintModel('party-loot');
    const props = tablePanelChromeHoverProps(setHint, hint);
    props.onMouseEnter();
    expect(setHint).toHaveBeenCalledWith(hint);
    props.onMouseLeave();
    const updater = setHint.mock.calls[1][0];
    expect(updater(hint)).toBeNull();
    expect(updater({ id: 'other' })).toEqual({ id: 'other' });
  });

  it('returns no handlers without a titled hint', () => {
    expect(tablePanelChromeHoverProps(vi.fn(), null)).toEqual({});
    expect(tablePanelChromeHoverProps(null, tablePanelHoverHintModel('party-loot'))).toEqual({});
  });
});

describe('Encounter panel chrome tooltip copy', () => {
  it('documents session, rest, fear, GM Moves, and card actions', () => {
    expect(tablePanelHoverHintModel('start-session').title).toBe('Start Session');
    expect(chromeTooltipLineText(tablePanelHoverHintModel('gm-moves').lines[0])).toContain('Click to show or hide');
    expect(tablePanelHoverHintModel('notes-section').lines).toEqual([
      { text: 'Click to open a note.', role: 'lead' },
      { text: 'Add a note', icon: 'plus' },
      { text: 'Show to players', icon: 'eye' },
      { text: 'GM only', icon: 'eye-off' },
      { text: 'Remove from the table', icon: 'trash' },
    ]);
    expect(tablePanelHoverHintModel('countdowns-section').lines).toEqual(expect.arrayContaining([
      { text: 'Click to open a countdown.', role: 'lead' },
      { text: 'Add a countdown', icon: 'plus' },
    ]));
    expect(tablePanelHoverHintModel('environments-section').lines).toEqual(expect.arrayContaining([
      { text: 'Add an environment', icon: 'plus' },
      { text: 'Remove from the table', icon: 'trash' },
    ]));
    expect(tablePanelHoverHintModel('environments-section', { removeFromScene: true }).lines).toEqual(
      expect.arrayContaining([{ text: 'Remove from the scene', icon: 'trash' }]),
    );
    expect(tablePanelHoverHintModel('adversaries-section').lines)
      .toEqual([
        { text: 'Click to open an adversary.', role: 'lead' },
        'Click a track to mark or clear HP or Stress.',
        ...ADVERSARY_RESOURCE_LEGEND_LINES,
        { text: 'Add an adversary', icon: 'plus', legend: 'functions' },
        { text: 'Add another copy or minion group', icon: 'plus', legend: 'functions' },
        { text: 'Remove one or last minion group', icon: 'minus', legend: 'functions' },
        { text: 'Remove from the table', icon: 'trash', legend: 'functions' },
        { text: 'Add conditions', icon: 'tag', legend: 'functions' },
      ]);
    expect(tablePanelHoverHintModel('adversaries-section', {}, { isPlayer: true }).lines).toEqual([
      { text: 'Wounded or marked adversaries the GM has revealed. Tracks are read-only.', role: 'lead' },
      ...ADVERSARY_RESOURCE_LEGEND_LINES,
    ]);
    expect(tablePanelHoverHintModel('load-scene').lines).toEqual([
      { text: 'Load a scene onto the table', icon: 'folder' },
    ]);
    expect(tablePanelHoverHintModel('call-for-reaction').lines).toEqual([
      { text: 'Click to open the reaction panel.', role: 'lead' },
      'Choose a default trait, characters, and a Difficulty.',
      'Each selected character can use a different trait.',
    ]);
  });
});

describe('Players / Characters / Encounter sidebar chrome tooltip wiring', () => {
  it('GMTableView publishes sidebar hover into BattleMap chromeTooltipHint', () => {
    const table = readFileSync(join(dir, '../../src/client/components/GMTableView.jsx'), 'utf8');
    expect(table).toContain("from '../lib/table-panel-hover-hint.js'");
    expect(table).toContain('chromeTooltipHint={panelChromeHint}');
    expect(table).toContain("panelChromeHover('support-table')");
    expect(table).toContain("panelChromeHover('invite-link'");
    expect(table).toContain("panelChromeHover('player'");
    expect(table).toContain("panelChromeHover('audience')");
    expect(table).toContain("panelChromeHover('characters-section'");
    expect(table).toContain("panelChromeHover('leave-table')");
    expect(table).toContain("panelChromeHover('bug-report')");
    expect(table).toContain("panelChromeHover('party-loot')");
    expect(table.indexOf("panelChromeHover('party-loot')")).toBeGreaterThan(
      table.indexOf("panelChromeHover('characters-section'"),
    );
    expect(table).toContain("panelChromeHover('start-session')");
    expect(table).toContain("panelChromeHover('gm-moves')");
    expect(table).toContain("panelChromeHover('load-scene')");
    expect(table).toContain("panelChromeHover('notes-section')");
    expect(table).toContain("panelChromeHover('countdowns-section')");
    expect(table).toContain("panelChromeHover('environments-section')");
    expect(table).toContain("panelChromeHover('adversaries-section')");
    expect(table).toContain("panelChromeHover('bp-budget')");
    expect(table).toContain("panelChromeHover('clear-table')");
    const map = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');
    expect(map).toContain('chromeTooltipHint = null');
    expect(map).toContain('panelHint: chromeTooltipHint');
    expect(map).toContain('map-chrome-show-instructions');
    expect(map).toContain("fontSize: '0.9rem'");
    expect(map).toContain("display: 'inline-block'");
    expect(map).toContain('CheckboxTrackMarkedIcon');
    expect(map).toContain('tag: Tag');
    const scene = readFileSync(join(dir, '../../src/client/components/forms/SceneTableEditor.jsx'), 'utf8');
    expect(scene).toContain('chromeTooltipHint={panelChromeHint}');
    expect(scene).toContain("panelChromeHover('gm-moves')");
    expect(scene).toContain("panelChromeHover('notes-section')");
    expect(scene).toContain("panelChromeHover('countdowns-section')");
    expect(scene).toContain("panelChromeHover('environments-section'");
    expect(scene).toContain("panelChromeHover('adversaries-section'");
  });
});
