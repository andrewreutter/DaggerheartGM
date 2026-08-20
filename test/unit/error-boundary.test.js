// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../src/client/components/ErrorBoundary.jsx';
import { AppRoot } from '../../src/client/components/AppRoot.jsx';
import {
  FatalErrorFallback,
  formatFatalErrorDetail,
} from '../../src/client/components/FatalErrorFallback.jsx';

function Boom() {
  throw new Error('boom-render');
}

function Ok() {
  return createElement('div', { 'data-testid': 'ok-child' }, 'ok');
}

describe('formatFatalErrorDetail', () => {
  it('includes error message and stack', () => {
    const error = new Error('copy-me');
    error.stack = 'Error: copy-me\n    at test';
    expect(formatFatalErrorDetail({ error, message: 'copy-me' })).toBe(
      'copy-me\n\nError: copy-me\n    at test',
    );
  });
});

describe('FatalErrorFallback', () => {
  let container;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('copies technical details when the details control is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const error = new Error('copy-me');
    error.stack = 'Error: copy-me\n    at test';

    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(FatalErrorFallback, {
          error,
          message: 'copy-me',
          onReload: () => {},
        }),
      );
    });

    const btn = [...container.querySelectorAll('button')].find((el) =>
      /technical details/i.test(el.textContent),
    );
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.click();
    });

    expect(writeText).toHaveBeenCalledWith('copy-me\n\nError: copy-me\n    at test');
    expect(container.textContent).toContain('Copied!');
  });
});

describe('ErrorBoundary', () => {
  let container;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('renders fallback when a child throws during render', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ErrorBoundary, null, createElement(Boom)));
    });
    expect(container.querySelector('[data-testid="fatal-error-fallback"]')).toBeTruthy();
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('boom-render');
    spy.mockRestore();
  });
});

describe('AppRoot', () => {
  let container;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('renders global unhandledrejection as fatal fallback', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(AppRoot, null, createElement(Ok)));
    });
    expect(container.querySelector('[data-testid="ok-child"]')).toBeTruthy();

    const promise = Promise.resolve();
    await act(async () => {
      const ev = new PromiseRejectionEvent('unhandledrejection', {
        promise,
        reason: new Error('promise-exploded'),
      });
      window.dispatchEvent(ev);
    });

    expect(container.querySelector('[data-testid="fatal-error-fallback"]')).toBeTruthy();
    expect(container.textContent).toContain('Unexpected error');
    expect(container.textContent).toContain('promise-exploded');
  });
});
