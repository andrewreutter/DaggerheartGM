import { describe, expect, it } from 'vitest';
import {
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
});
