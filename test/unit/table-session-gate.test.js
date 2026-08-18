import { describe, it, expect } from 'vitest';
import {
  characterSheetTableInteractionFlags,
  gmResourceTrackCheckboxEditsAllowed,
  showSessionBlockedDiceBanner,
  gateTableOpForPrepMode,
  isPrepModeElementUpdateBlocked,
  isTablePlayAllowed,
  PREP_MODE_ALLOWED_ELEMENT_UPDATE_KEYS,
} from '../../src/client/lib/table-session-gate.js';

describe('table-session-gate', () => {
  const prepState = { top: { sessionStarted: false } };

  it('blocks token position updates during prep', () => {
    expect(PREP_MODE_ALLOWED_ELEMENT_UPDATE_KEYS.has('tokenX')).toBe(false);
    expect(isPrepModeElementUpdateBlocked({ tokenX: 1 })).toBe(true);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { tokenX: 5, tokenY: 3 },
    });
    expect(g.ok).toBe(false);
  });

  it('allows dragging/resizing a mapImage during prep (scene setup, not a gameplay token)', () => {
    expect(isPrepModeElementUpdateBlocked({ tokenX: 1 }, 'mapImage')).toBe(false);
    const stateWithMapImage = {
      ...prepState,
      elements: [{ instanceId: 'a', elementType: 'mapImage', tokenX: 0, tokenY: 0 }],
    };
    const g = gateTableOpForPrepMode(stateWithMapImage, {
      op: 'update-element',
      instanceId: 'a',
      updates: { tokenX: 5, tokenY: 3 },
    });
    expect(g.ok).toBe(true);
  });

  it('allows dragging/resizing a drawShape during prep', () => {
    expect(isPrepModeElementUpdateBlocked({ widthFt: 10, heightFt: 10 }, 'drawShape')).toBe(false);
    const stateWithShape = {
      ...prepState,
      elements: [{ instanceId: 'b', elementType: 'drawShape', tokenX: 0, tokenY: 0 }],
    };
    const g = gateTableOpForPrepMode(stateWithShape, {
      op: 'update-elements',
      updates: [{ instanceId: 'b', updates: { widthFt: 10, heightFt: 10 } }],
    });
    expect(g.ok).toBe(true);
  });

  it('still blocks token position updates on a real character/adversary token during prep, even with mapImage elements present', () => {
    const state = {
      ...prepState,
      elements: [
        { instanceId: 'a', elementType: 'mapImage' },
        { instanceId: 'c', elementType: 'character' },
      ],
    };
    const g = gateTableOpForPrepMode(state, {
      op: 'update-element',
      instanceId: 'c',
      updates: { tokenX: 5, tokenY: 3 },
    });
    expect(g.ok).toBe(false);
  });

  it('blocks conditions updates during prep (conditions are play-state, not setup)', () => {
    expect(isPrepModeElementUpdateBlocked({ conditions: 'foo' })).toBe(true);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { conditions: 'note' },
    });
    expect(g.ok).toBe(false);
  });

  it('allows minPartySize updates during prep (encounter-design scale tag)', () => {
    expect(isPrepModeElementUpdateBlocked({ minPartySize: 4 })).toBe(false);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { minPartySize: 4 },
    });
    expect(g.ok).toBe(true);
  });

  it('allows visibleToPlayers updates during prep (staging hidden adversaries)', () => {
    expect(isPrepModeElementUpdateBlocked({ visibleToPlayers: false })).toBe(false);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { visibleToPlayers: false },
    });
    expect(g.ok).toBe(true);
  });

  it('allows assignedPlayerEmail updates during prep (roster bookkeeping)', () => {
    expect(isPrepModeElementUpdateBlocked({ assignedPlayerEmail: 'player@example.com' })).toBe(false);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { assignedPlayerEmail: 'player@example.com' },
    });
    expect(g.ok).toBe(true);
  });

  it('allows note name/body/visibility updates during prep (note type is exempt)', () => {
    expect(isPrepModeElementUpdateBlocked({ name: 'My Note', body: 'text', visibility: 'gm' }, 'note')).toBe(false);
    const stateWithNote = {
      ...prepState,
      elements: [{ instanceId: 'n1', elementType: 'note', name: 'Old', body: '' }],
    };
    const g = gateTableOpForPrepMode(stateWithNote, {
      op: 'update-element',
      instanceId: 'n1',
      updates: { name: 'New Title', body: 'Updated body' },
    });
    expect(g.ok).toBe(true);
  });

  it('still blocks conditions on a character/adversary even when note elements are present', () => {
    const state = {
      ...prepState,
      elements: [
        { instanceId: 'n1', elementType: 'note' },
        { instanceId: 'c1', elementType: 'character' },
      ],
    };
    const g = gateTableOpForPrepMode(state, {
      op: 'update-element',
      instanceId: 'c1',
      updates: { conditions: 'Frightened' },
    });
    expect(g.ok).toBe(false);
  });

  it('allows update-base-data during prep (library save → table element sync)', () => {
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-base-data',
      elementId: 'adv-1',
      newBaseData: { name: 'Goblin', tier: 1, role: 'Standard' },
    });
    expect(g.ok).toBe(true);
  });

  it('allows update-base-data during idle session pause', () => {
    const paused = { top: { sessionStarted: true, sessionPaused: true } };
    expect(isTablePlayAllowed(paused)).toBe(false);
    const g = gateTableOpForPrepMode(paused, {
      op: 'update-base-data',
      elementId: 'adv-1',
      newBaseData: { name: 'Goblin' },
    });
    expect(g.ok).toBe(true);
  });

  it('allows add-player-email and remove-player-email during prep', () => {
    const add = gateTableOpForPrepMode(prepState, { op: 'add-player-email', email: 'a@b.com' });
    expect(add.ok).toBe(true);
    expect(add.op.op).toBe('add-player-email');
    const remove = gateTableOpForPrepMode(prepState, { op: 'remove-player-email', email: 'a@b.com' });
    expect(remove.ok).toBe(true);
    expect(remove.op.op).toBe('remove-player-email');
  });

  it('allows add-scene-snapshot during prep (Add Scene from library)', () => {
    const g = gateTableOpForPrepMode(prepState, {
      op: 'add-scene-snapshot',
      maps: [{ id: 'm1' }],
      mapViews: [],
      elements: [{ instanceId: 'e1', elementType: 'adversary' }],
    });
    expect(g.ok).toBe(true);
  });

  it('allows add-scene-snapshot during idle session pause', () => {
    const paused = { top: { sessionStarted: true, sessionPaused: true } };
    expect(isTablePlayAllowed(paused)).toBe(false);
    const g = gateTableOpForPrepMode(paused, {
      op: 'add-scene-snapshot',
      maps: [{ id: 'm1' }],
      mapViews: [],
      elements: [],
    });
    expect(g.ok).toBe(true);
  });

  it('allows replace-scene-snapshot during prep and idle pause', () => {
    const g = gateTableOpForPrepMode(prepState, {
      op: 'replace-scene-snapshot',
      maps: [{ id: 'm1' }],
      mapViews: [],
      elements: [{ instanceId: 'e1', elementType: 'adversary' }],
    });
    expect(g.ok).toBe(true);
    const paused = { top: { sessionStarted: true, sessionPaused: true } };
    expect(gateTableOpForPrepMode(paused, { op: 'replace-scene-snapshot', maps: [], mapViews: [], elements: [] }).ok).toBe(true);
  });

  it('blocks set-party-loot and move-inventory-item during prep', () => {
    expect(gateTableOpForPrepMode(prepState, { op: 'set-party-loot', gold: 1 }).ok).toBe(false);
    expect(gateTableOpForPrepMode(prepState, {
      op: 'move-inventory-item',
      from: { scope: 'party' },
      to: { scope: 'character', instanceId: 'c1' },
      uid: 'u1',
    }).ok).toBe(false);
  });

  it('allows set-spotlight during prep so the GM can assign a holder before session start', () => {
    const g = gateTableOpForPrepMode(prepState, {
      op: 'set-spotlight',
      spotlight: { holderType: 'gm', holderInstanceId: null, rollSeq: 0, lastSeenSeq: {} },
    });
    expect(g.ok).toBe(true);
  });

  it('allows set-table-public during prep', () => {
    const g = gateTableOpForPrepMode(prepState, { op: 'set-table-public', isPublic: true });
    expect(g.ok).toBe(true);
  });

  it('bypassPrepGate allows a single blocked update without changing session state in the gate', () => {
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { tokenX: 1, tokenY: 2 },
      bypassPrepGate: true,
    });
    expect(g.ok).toBe(true);
    expect(g.op.bypassPrepGate).toBeUndefined();
    expect(g.op.updates.tokenX).toBe(1);
  });

  it('strips bypassPrepGate when play is already allowed', () => {
    const active = { top: { sessionStarted: true, sessionPaused: false } };
    expect(isTablePlayAllowed(active)).toBe(true);
    const g = gateTableOpForPrepMode(active, {
      op: 'update-element',
      instanceId: 'a',
      updates: { tokenX: 1 },
      bypassPrepGate: true,
    });
    expect(g.ok).toBe(true);
    expect(g.op.bypassPrepGate).toBeUndefined();
  });

  describe('characterSheetTableInteractionFlags', () => {
    it('GM keeps sheetOwner when session play is blocked so updateFn can show prep dialog', () => {
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(false, false, false);
      expect(sheetOwner).toBe(true);
      expect(allowPlayMechanics).toBe(false);
    });

    it('active session + GM enables play mechanics', () => {
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(true, false, false);
      expect(sheetOwner).toBe(true);
      expect(allowPlayMechanics).toBe(true);
    });

    it('spectating player sheet is neither owner nor play', () => {
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(true, true, false);
      expect(sheetOwner).toBe(false);
      expect(allowPlayMechanics).toBe(false);
    });

    it('assigned player is owner; prep blocks play mechanics only', () => {
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(false, true, true);
      expect(sheetOwner).toBe(true);
      expect(allowPlayMechanics).toBe(false);
    });

    it('assigned player with active session: same flags as CharacterHoverCard / sidebar character card tracks', () => {
      const { sheetOwner, allowPlayMechanics } = characterSheetTableInteractionFlags(true, true, true);
      expect(sheetOwner).toBe(true);
      expect(allowPlayMechanics).toBe(true);
    });
  });

  describe('gmResourceTrackCheckboxEditsAllowed', () => {
    it('is true for GM session', () => {
      expect(gmResourceTrackCheckboxEditsAllowed(false)).toBe(true);
    });

    it('is false for player session (manual Hope/HP/Stress/Armor marks are GM-only in UI)', () => {
      expect(gmResourceTrackCheckboxEditsAllowed(true)).toBe(false);
    });
  });

  describe('showSessionBlockedDiceBanner', () => {
    it('is true when prep (session not started)', () => {
      expect(showSessionBlockedDiceBanner(false, false)).toBe(true);
    });

    it('is true when idle pause with session started', () => {
      expect(showSessionBlockedDiceBanner(true, true)).toBe(true);
    });

    it('is false when session active and unpaused', () => {
      expect(showSessionBlockedDiceBanner(true, false)).toBe(false);
    });
  });
});
