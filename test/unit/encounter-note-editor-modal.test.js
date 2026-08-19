// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { EncounterNoteEditorForm } from '../../src/client/components/EncounterNoteEditorForm.jsx';

describe('EncounterNoteEditorForm', () => {
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
        createElement(EncounterNoteEditorForm, {
          noteKey: 'n1',
          name: 'My note title',
          body: 'x',
          onApplyPatch: () => {},
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

  it('applies visibility immediately when the toggle is clicked', async () => {
    const onApplyPatch = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(EncounterNoteEditorForm, {
          noteKey: 'n2',
          name: 'N',
          body: '',
          visibility: 'gm',
          onApplyPatch,
        }),
      );
    });
    const visBtn = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('GM only (hidden from players)'),
    );
    expect(visBtn).toBeTruthy();
    await act(async () => {
      visBtn.click();
    });
    expect(onApplyPatch).toHaveBeenCalledWith({ visibility: 'players' });
  });

  it('shows the same visibility toggle copy as session countdowns when GM-only', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(EncounterNoteEditorForm, {
          noteKey: 'n3',
          name: 'N',
          body: '',
          visibility: 'gm',
          onApplyPatch: () => {},
        }),
      );
    });
    const visBtn = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('GM only (hidden from players)'),
    );
    expect(visBtn).toBeTruthy();
  });
});
