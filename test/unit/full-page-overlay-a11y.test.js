// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { FullPageOverlay, FullPageOverlayHeader } from '../../src/client/components/FullPageOverlay.jsx';

describe('FullPageOverlay', () => {
  let container;
  let root;

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('keeps the dimmed backdrop out of the tab order so panel controls stay reachable', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          FullPageOverlay,
          {
            open: true,
            onClose: () => {},
            ariaLabel: 'Test',
            children: createElement('button', { type: 'button' }, 'Inside'),
          },
        ),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const backdrop = dialog.querySelector(':scope > button[aria-label="Close"]');
    expect(backdrop).toBeTruthy();
    expect(backdrop.getAttribute('tabindex')).toBe('-1');
  });

  it('header close control uses explicit tabindex 0 for Safari', async () => {
    function StubIcon() {
      return null;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          FullPageOverlay,
          {
            open: true,
            onClose: () => {},
            ariaLabelledBy: 'fp-test-title',
            children: [
              createElement(FullPageOverlayHeader, {
                key: 'hdr',
                title: 'Hello',
                titleId: 'fp-test-title',
                icon: StubIcon,
                onClose: () => {},
              }),
              createElement('div', { key: 'body' }, 'Content'),
            ],
          },
        ),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    const closeButtons = dialog.querySelectorAll('button[aria-label="Close"]');
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    expect(closeButtons[0].getAttribute('tabindex')).toBe('-1');
    expect(closeButtons[1].getAttribute('tabindex')).toBe('0');
  });

  it('moves focus into the panel (first focusable descendant) when it opens', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          FullPageOverlay,
          {
            open: true,
            onClose: () => {},
            ariaLabel: 'Test',
            children: [
              createElement('button', { key: 'a', type: 'button' }, 'First'),
              createElement('button', { key: 'b', type: 'button' }, 'Second'),
            ],
          },
        ),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = dialog.querySelectorAll('button');
    // buttons[0] is the backdrop (tabindex -1, excluded from focus targets); the
    // first real focusable descendant inside the panel is "First".
    expect(document.activeElement.textContent).toBe('First');
  });

  it('traps Tab so focus wraps from the last focusable element back to the first', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          FullPageOverlay,
          {
            open: true,
            onClose: () => {},
            ariaLabel: 'Test',
            children: [
              createElement('button', { key: 'a', type: 'button' }, 'First'),
              createElement('button', { key: 'b', type: 'button' }, 'Last'),
            ],
          },
        ),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    const [first, last] = dialog.querySelectorAll('button:not([aria-label="Close"])');
    last.focus();
    expect(document.activeElement).toBe(last);
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => {
      document.dispatchEvent(tabEvent);
    });
    expect(document.activeElement).toBe(first);
  });

  it('traps Shift+Tab so focus wraps from the first focusable element back to the last', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          FullPageOverlay,
          {
            open: true,
            onClose: () => {},
            ariaLabel: 'Test',
            children: [
              createElement('button', { key: 'a', type: 'button' }, 'First'),
              createElement('button', { key: 'b', type: 'button' }, 'Last'),
            ],
          },
        ),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    const [first, last] = dialog.querySelectorAll('button:not([aria-label="Close"])');
    // First-focusable-on-open already put focus on `first`; shift+Tab from there should wrap to `last`.
    expect(document.activeElement).toBe(first);
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    await act(async () => {
      document.dispatchEvent(shiftTabEvent);
    });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the previously-focused element when the overlay closes', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const trigger = document.createElement('button');
    trigger.textContent = 'Open modal';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(FullPageOverlay, {
          open: true,
          onClose: () => {},
          ariaLabel: 'Test',
          children: createElement('button', { type: 'button' }, 'Inside'),
        }),
      );
    });
    expect(document.activeElement.textContent).toBe('Inside');

    await act(async () => {
      root.render(
        createElement(FullPageOverlay, {
          open: false,
          onClose: () => {},
          ariaLabel: 'Test',
          children: createElement('button', { type: 'button' }, 'Inside'),
        }),
      );
    });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
