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

  it('allows conditions-only updates during prep', () => {
    expect(isPrepModeElementUpdateBlocked({ conditions: 'foo' })).toBe(false);
    const g = gateTableOpForPrepMode(prepState, {
      op: 'update-element',
      instanceId: 'a',
      updates: { conditions: 'note' },
    });
    expect(g.ok).toBe(true);
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
