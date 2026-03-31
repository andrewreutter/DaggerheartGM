// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { EncounterNoteEditorModal } from '../../src/client/components/modals/EncounterNoteEditorModal.jsx';

describe('EncounterNoteEditorModal', () => {
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

  it('focuses the title field and selects the title when opened', async () => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(EncounterNoteEditorModal, {
          open: true,
          name: 'My note title',
          body: 'x',
          onClose: () => {},
          onSave: () => {},
        }),
      );
    });
    await act(async () => {
      vi.runAllTimers();
    });
    const input = document.body.querySelector('input[placeholder="Short label"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('My note title');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('My note title'.length);
  });

  it('exposes Cancel/Save with explicit tabindex 0 (Safari tab order)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(EncounterNoteEditorModal, {
          open: true,
          name: 'N',
          body: '',
          onClose: () => {},
          onSave: () => {},
        }),
      );
    });
    const buttons = [...document.body.querySelectorAll('[role="dialog"] button')].filter(
      (b) => b.textContent === 'Cancel' || b.textContent === 'Save',
    );
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.getAttribute('tabindex')).toBe('0');
    }
  });

  it('shows the same visibility toggle copy as session countdowns when GM-only', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(EncounterNoteEditorModal, {
          open: true,
          name: 'N',
          body: '',
          visibility: 'gm',
          onClose: () => {},
          onSave: () => {},
        }),
      );
    });
    const visBtn = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('GM only (hidden from players)'),
    );
    expect(visBtn).toBeTruthy();
  });
});
