// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, createElement, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DH_OUTSIDE_DISMISS_EXEMPT_ATTR,
  useHoverOverlay,
} from '../../src/client/lib/useHoverOverlay.js';

function Harness({ disableDesktopOutsideDismiss }) {
  const o = useHoverOverlay({
    isTouch: false,
    mode: 'click',
    disableDesktopOutsideDismiss,
  });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    o.show({ k: 1 });
  }, []);
  return createElement(
    'div',
    { ref: o.overlayRef, 'data-testid': 'overlay' },
    createElement('span', {
      'data-testid': 'open-flag',
      'data-open': String(o.isOpen),
    }),
  );
}

describe('useHoverOverlay', () => {
  let container;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('with disableDesktopOutsideDismiss, document mousedown outside overlay does not close', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(Harness, { disableDesktopOutsideDismiss: true }),
      );
    });
    expect(
      container.querySelector('[data-testid="open-flag"]')?.getAttribute('data-open'),
    ).toBe('true');
    await act(async () => {
      document.body.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      );
    });
    expect(
      container.querySelector('[data-testid="open-flag"]')?.getAttribute('data-open'),
    ).toBe('true');
  });

  it('without disableDesktopOutsideDismiss, document mousedown outside overlay closes', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(Harness, { disableDesktopOutsideDismiss: false }),
      );
    });
    expect(
      container.querySelector('[data-testid="open-flag"]')?.getAttribute('data-open'),
    ).toBe('true');
    await act(async () => {
      document.body.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      );
    });
    expect(
      container.querySelector('[data-testid="open-flag"]')?.getAttribute('data-open'),
    ).toBe('false');
  });

  it('mousedown inside data-dh-outside-dismiss-exempt portal does not close', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(Harness, { disableDesktopOutsideDismiss: false }),
      );
    });
    const portal = document.createElement('div');
    portal.setAttribute(DH_OUTSIDE_DISMISS_EXEMPT_ATTR, '');
    const opt = document.createElement('button');
    portal.appendChild(opt);
    document.body.appendChild(portal);
    try {
      await act(async () => {
        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      });
      expect(
        container.querySelector('[data-testid="open-flag"]')?.getAttribute('data-open'),
      ).toBe('true');
    } finally {
      portal.remove();
    }
  });
});
