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
});
