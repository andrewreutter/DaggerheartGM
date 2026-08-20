import { describe, expect, it } from 'vitest';
import {
  buildGmTokenMovesOverlayData,
  GM_TOKEN_HINT_INSTANCE_ID,
  GM_TOKEN_HOVER_HINT_CONTENT_LINES,
  GM_TOKEN_HOVER_HINT_ELEMENT,
  GM_TOKEN_HOVER_HINT_LINES,
  GM_TOKEN_HOVER_HINT_LINES_TOUCH,
  isGmTokenMovesOverlay,
  isGmTokenOverlayActivateEvent,
  isModifierKeyDown,
  isTokenOverlayActivateEvent,
  resolveTokenHoverHintElement,
  suppressBrowserContextMenu,
  swallowNextContextMenu,
  tokenHoverHintModel,
  tokenHoverTooltipName,
  tokenHoverTooltipText,
} from '../../src/client/lib/token-overlay-activate.js';

describe('isModifierKeyDown', () => {
  it('is true for shift, ctrl, meta, or alt', () => {
    expect(isModifierKeyDown({ shiftKey: true })).toBe(true);
    expect(isModifierKeyDown({ ctrlKey: true })).toBe(true);
    expect(isModifierKeyDown({ metaKey: true })).toBe(true);
    expect(isModifierKeyDown({ altKey: true })).toBe(true);
  });

  it('is false without modifiers', () => {
    expect(isModifierKeyDown({})).toBe(false);
    expect(isModifierKeyDown(null)).toBe(false);
  });
});

describe('isTokenOverlayActivateEvent', () => {
  it('treats right-click as overlay activate', () => {
    expect(isTokenOverlayActivateEvent({ button: 2 })).toBe(true);
  });

  it('treats modifier + left-click as overlay activate', () => {
    expect(isTokenOverlayActivateEvent({ button: 0, shiftKey: true })).toBe(true);
    expect(isTokenOverlayActivateEvent({ button: 0, ctrlKey: true })).toBe(true);
    expect(isTokenOverlayActivateEvent({ button: 0, metaKey: true })).toBe(true);
    expect(isTokenOverlayActivateEvent({ button: 0, altKey: true })).toBe(true);
  });

  it('does not treat a plain left-click as overlay activate', () => {
    expect(isTokenOverlayActivateEvent({ button: 0 })).toBe(false);
    expect(isTokenOverlayActivateEvent({ button: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
  });

  it('does not treat middle-click or modifier + right-button extras as left-click activate', () => {
    expect(isTokenOverlayActivateEvent({ button: 1 })).toBe(false);
    expect(isTokenOverlayActivateEvent({ button: 1, shiftKey: true })).toBe(false);
    expect(isTokenOverlayActivateEvent(null)).toBe(false);
  });
});

describe('isGmTokenOverlayActivateEvent', () => {
  it('treats plain left-click and right-click as activate', () => {
    expect(isGmTokenOverlayActivateEvent({ button: 0 })).toBe(true);
    expect(isGmTokenOverlayActivateEvent({ button: 2 })).toBe(true);
  });

  it('does not treat middle-click or a missing event as activate', () => {
    expect(isGmTokenOverlayActivateEvent({ button: 1 })).toBe(false);
    expect(isGmTokenOverlayActivateEvent(null)).toBe(false);
  });
});

describe('suppressBrowserContextMenu', () => {
  it('prevents default and stops propagation', () => {
    const e = { preventDefault: () => { e.prevented = true; }, stopPropagation: () => { e.stopped = true; } };
    suppressBrowserContextMenu(e);
    expect(e.prevented).toBe(true);
    expect(e.stopped).toBe(true);
  });

  it('no-ops on a missing event', () => {
    expect(() => suppressBrowserContextMenu(null)).not.toThrow();
  });
});

describe('buildGmTokenMovesOverlayData', () => {
  it('stamps source gm-token and the trigger left edge', () => {
    expect(buildGmTokenMovesOverlayData({ getBoundingClientRect: () => ({ left: 880 }) })).toEqual({
      source: 'gm-token',
      edgeLeft: 880,
    });
  });

  it('uses a null edge when the trigger has no box', () => {
    expect(buildGmTokenMovesOverlayData(null)).toEqual({ source: 'gm-token', edgeLeft: null });
  });
});

describe('isGmTokenMovesOverlay', () => {
  it('is true only for gm-token source data', () => {
    expect(isGmTokenMovesOverlay({ source: 'gm-token' })).toBe(true);
    expect(isGmTokenMovesOverlay({ source: 'encounter' })).toBe(false);
    expect(isGmTokenMovesOverlay(null)).toBe(false);
  });
});

describe('swallowNextContextMenu', () => {
  it('suppresses the next capture-phase contextmenu then removes the listener', () => {
    const listeners = [];
    const root = {
      addEventListener: (type, fn, capture) => { listeners.push({ type, fn, capture }); },
      removeEventListener: (type, fn, capture) => {
        const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
        if (i >= 0) listeners.splice(i, 1);
      },
    };
    swallowNextContextMenu(root, 5000);
    expect(listeners).toHaveLength(1);
    const ev = { preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; } };
    listeners[0].fn(ev);
    expect(ev.prevented).toBe(true);
    expect(ev.stopped).toBe(true);
    expect(listeners).toHaveLength(0);
  });

  it('no-ops without a root', () => {
    expect(typeof swallowNextContextMenu(null)).toBe('function');
  });
});

describe('tokenHoverTooltipText', () => {
  it('uses the token name plus the three interaction lines', () => {
    expect(tokenHoverTooltipText('Vivius')).toBe(
      'Vivius\nClick and drag to move.\nTo adjust altitude, click and drag the distance display to the left of the token.\nRight-click for action card.',
    );
  });

  it('resolves companion label over name', () => {
    expect(tokenHoverTooltipText({
      elementType: 'boardToken',
      label: 'Ash',
      name: 'Companion',
    })).toBe(
      'Ash\nClick and drag to move.\nTo adjust altitude, click and drag the distance display to the left of the token.\nRight-click for action card.',
    );
  });

  it('falls back to Token when the name is empty', () => {
    expect(tokenHoverTooltipName({ name: '   ' })).toBe('Token');
    expect(tokenHoverTooltipText('')).toMatch(/^Token\n/);
  });

  it('splits the name from smaller hint lines for the static inset', () => {
    expect(tokenHoverHintModel('Vivius')).toEqual({
      name: 'Vivius',
      lines: [
        'Click and drag to move.',
        'To adjust altitude, click and drag the distance display to the left of the token.',
        'Right-click for action card.',
      ],
    });
  });

  it('documents click or right-click toggle for the GM crown', () => {
    expect(tokenHoverTooltipName(GM_TOKEN_HOVER_HINT_ELEMENT)).toBe('GM Moves');
    expect(tokenHoverHintModel(GM_TOKEN_HOVER_HINT_ELEMENT)).toEqual({
      name: 'GM Moves',
      lines: GM_TOKEN_HOVER_HINT_LINES,
    });
    expect(tokenHoverHintModel(GM_TOKEN_HOVER_HINT_ELEMENT, { isTouch: true })).toEqual({
      name: 'GM Moves',
      lines: GM_TOKEN_HOVER_HINT_LINES_TOUCH,
    });
    expect(tokenHoverHintModel(GM_TOKEN_HOVER_HINT_ELEMENT, { isPlayer: true })).toEqual({
      name: 'GM Moves',
      lines: [],
    });
  });

  it('summarizes homepage GM Moves copy for running the table', () => {
    const body = GM_TOKEN_HOVER_HINT_CONTENT_LINES.join(' ');
    expect(body).toMatch(/environments and adversaries/i);
    expect(body).not.toMatch(/Encounter order/i);
    expect(body).toMatch(/off-camera adversaries and environments/i);
    expect(body).toMatch(/roll/i);
    expect(GM_TOKEN_HOVER_HINT_LINES[0]).toMatch(/Click or right-click/);
    expect(GM_TOKEN_HOVER_HINT_LINES_TOUCH[0]).toMatch(/^Tap /);
    expect(GM_TOKEN_HOVER_HINT_LINES.slice(1)).toEqual(GM_TOKEN_HOVER_HINT_CONTENT_LINES);
    expect(GM_TOKEN_HOVER_HINT_LINES_TOUCH.slice(1)).toEqual(GM_TOKEN_HOVER_HINT_CONTENT_LINES);
  });
});

describe('resolveTokenHoverHintElement', () => {
  const char = { instanceId: 'c1', elementType: 'character', name: 'Vivius' };
  const adv = { instanceId: 'a1', elementType: 'adversary', name: 'Goblin' };
  const note = { instanceId: 'n1', elementType: 'note', name: 'Note' };

  it('prefers the tray hover over a snapped map token', () => {
    expect(resolveTokenHoverHintElement({
      trayHoverInstanceId: 'a1',
      snappedInstanceId: 'c1',
      elements: [char, adv],
    })).toBe(adv);
  });

  it('uses the snapped map token when the tray is not hovered', () => {
    expect(resolveTokenHoverHintElement({
      snappedInstanceId: 'c1',
      elements: [char, adv],
    })).toBe(char);
  });

  it('hides while dragging and skips non-token types', () => {
    expect(resolveTokenHoverHintElement({
      snappedInstanceId: 'c1',
      elements: [char],
      dragging: true,
    })).toBeNull();
    expect(resolveTokenHoverHintElement({
      snappedInstanceId: 'n1',
      elements: [note],
    })).toBeNull();
  });

  it('returns the synthetic GM crown element for the tray hover sentinel', () => {
    expect(resolveTokenHoverHintElement({
      trayHoverInstanceId: GM_TOKEN_HINT_INSTANCE_ID,
      snappedInstanceId: 'c1',
      elements: [char],
    })).toEqual(GM_TOKEN_HOVER_HINT_ELEMENT);
    expect(resolveTokenHoverHintElement({
      trayHoverInstanceId: GM_TOKEN_HINT_INSTANCE_ID,
      elements: [char],
      dragging: true,
    })).toBeNull();
  });
});
