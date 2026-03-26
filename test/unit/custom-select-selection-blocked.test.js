// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { CustomSelect } from '../../src/client/components/forms/CustomSelect.jsx';

describe('CustomSelect selectionBlocked', () => {
  let container;

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
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('does not use native disabled on the trigger when only selectionBlocked (browse tooltips)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(CustomSelect, {
          disabled: false,
          selectionBlocked: true,
          disabledReason: 'Need 3 Hope',
          options: [{ id: 'a', name: 'Option A', description: 'Details' }],
          getOptionLabel: (o) => o.name,
          getOptionKey: (o) => o.id,
          getOptionDescription: (o) => o.description,
          onChange: () => {},
          placeholder: 'Pick',
        }),
      );
    });
    const btn = container.querySelector('button[type="button"]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('still native-disables the trigger when disabled (hard lock)', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(CustomSelect, {
          disabled: true,
          selectionBlocked: false,
          disabledReason: 'Locked',
          options: [{ id: 'a', name: 'A' }],
          getOptionLabel: (o) => o.name,
          getOptionKey: (o) => o.id,
          onChange: () => {},
          placeholder: 'Pick',
        }),
      );
    });
    const btn = container.querySelector('button[type="button"]');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe(null);
  });
});
