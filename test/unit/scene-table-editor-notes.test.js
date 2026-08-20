// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../src/client/components/BattleMap.jsx', () => ({
  BattleMap: () => null,
}));

vi.mock('../../src/client/components/SessionCountdownsPanel.jsx', () => ({
  SessionCountdownsPanel: () => null,
}));

vi.mock('../../src/client/components/modals/ItemPickerModal.jsx', () => ({
  ItemPickerModal: () => null,
}));

vi.mock('../../src/client/components/features/FeatureSourceModal.jsx', () => ({
  FeatureSourceModal: () => null,
}));

import { SceneTableEditor } from '../../src/client/components/forms/SceneTableEditor.jsx';

function sceneWithNote(overrides = {}) {
  return {
    name: 'Ambush',
    activeElements: [
      {
        instanceId: 'note-1',
        elementType: 'note',
        id: 'note-1',
        name: 'Secret door',
        body: 'Behind the tapestry',
        ...overrides,
      },
    ],
  };
}

describe('SceneTableEditor notes', () => {
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
        dispatchEvent: () => {},
      }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('hides the note card trash until the card is hovered', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithNote(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-note-card"]');
    const remove = card.querySelector('button[title="Remove note"]');
    expect(remove).toBeTruthy();
    expect(card.className.split(/\s+/)).toContain('group/note');
    expect(remove.className.split(/\s+/)).toContain('hidden');
    expect(remove.className.split(/\s+/)).toContain('group-hover/note:block');
  });

  it('opens the encounter note editor when a scene note card is clicked and applies body edits on blur', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithNote(),
          onChange,
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-note-card"]');
    expect(card).toBeTruthy();
    await act(async () => {
      card.click();
    });

    const titleInput = document.body.querySelector('input[placeholder="Short label"]');
    expect(titleInput).toBeTruthy();
    expect(titleInput.value).toBe('Secret door');

    const bodyField = document.body.querySelector('textarea[placeholder="Note text…"]');
    expect(bodyField).toBeTruthy();
    await act(async () => {
      bodyField.focus();
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setValue.call(bodyField, 'Look behind the altar');
      bodyField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      bodyField.blur();
    });

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)[0];
    const note = last.activeElements.find((el) => el.instanceId === 'note-1');
    expect(note.body).toBe('Look behind the altar');
    expect(note.name).toBe('Secret door');
  });

  it('opens the encounter note editor when adding a scene note', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: { name: 'Empty', activeElements: [] },
          onChange,
        }),
      );
    });

    const addBtn = container.querySelector('[data-testid="encounter-add-note"]');
    expect(addBtn).toBeTruthy();
    await act(async () => {
      addBtn.click();
    });

    const titleInput = document.body.querySelector('input[placeholder="Short label"]');
    expect(titleInput).toBeTruthy();
    expect(titleInput.value).toBe('Note');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)[0];
    expect(last.activeElements.some((el) => el.elementType === 'note')).toBe(true);
  });
});
