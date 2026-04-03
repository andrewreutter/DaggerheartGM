// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useAutoSaveUndo } from '../../src/client/lib/useAutoSaveUndo.js';

function Harness({ sessionKey, initial, onSave, isNew, onExpose }) {
  const r = useAutoSaveUndo({ initial, onSave, sessionKey, isNew: !!isNew });
  useEffect(() => {
    onExpose(r);
  });
  return null;
}

describe('useAutoSaveUndo', () => {
  let container;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('resets formData when sessionKey changes', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSave = vi.fn(async () => {});
    let exposed;

    const initialA = { id: 'a', name: 'Alice' };
    const initialB = { id: 'b', name: 'Bob' };

    await act(async () => {
      root.render(
        createElement(Harness, {
          sessionKey: 'a',
          initial: initialA,
          onSave,
          isNew: false,
          onExpose: (x) => {
            exposed = x;
          },
        }),
      );
    });
    expect(exposed.formData.name).toBe('Alice');

    await act(async () => {
      root.render(
        createElement(Harness, {
          sessionKey: 'b',
          initial: initialB,
          onSave,
          isNew: false,
          onExpose: (x) => {
            exposed = x;
          },
        }),
      );
    });
    expect(exposed.formData.name).toBe('Bob');
    expect(exposed.formData.id).toBe('b');
  });

  it('sets savedOnce from isNew after sessionKey change', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSave = vi.fn(async () => {});
    let exposed;

    await act(async () => {
      root.render(
        createElement(Harness, {
          sessionKey: 'x',
          initial: { id: 'x', name: 'N' },
          onSave,
          isNew: true,
          onExpose: (x) => {
            exposed = x;
          },
        }),
      );
    });
    expect(exposed.savedOnce).toBe(false);

    await act(async () => {
      root.render(
        createElement(Harness, {
          sessionKey: 'y',
          initial: { id: 'y', name: 'M' },
          onSave,
          isNew: false,
          onExpose: (x) => {
            exposed = x;
          },
        }),
      );
    });
    expect(exposed.savedOnce).toBe(true);
  });
});
