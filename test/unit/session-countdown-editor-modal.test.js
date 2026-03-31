// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionCountdownEditorModal } from '../../src/client/components/modals/SessionCountdownEditorModal.jsx';
import { normalizeSessionCountdownEntry } from '../../src/client/lib/session-countdowns.js';

describe('SessionCountdownEditorModal', () => {
  let container;
  let root;

  beforeEach(() => {
    window.matchMedia =
      window.matchMedia ||
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => {},
      }));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('focuses the name field when opened and applies patch on Save', async () => {
    vi.useFakeTimers();
    const onApplyPatch = vi.fn();
    const onClose = vi.fn();
    const onRemove = vi.fn();
    const row = normalizeSessionCountdownEntry({
      id: 'r1',
      label: 'Clock',
      kind: 'standard',
      start: 6,
      current: 4,
      visibility: 'players',
      autoStandard: true,
      autoDynamic: false,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SessionCountdownEditorModal, {
          open: true,
          row,
          onClose,
          onApplyPatch,
          onRemove,
        }),
      );
    });
    await act(async () => {
      vi.runAllTimers();
    });

    const input = document.body.querySelector('input[placeholder="Label"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Clock');

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Save');
    expect(saveBtn).toBeTruthy();
    await act(async () => {
      saveBtn.click();
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(1);
    expect(onApplyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Clock',
        kind: 'standard',
        visibility: 'players',
        autoStandard: true,
        autoDynamic: false,
        start: 6,
        current: 4,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
