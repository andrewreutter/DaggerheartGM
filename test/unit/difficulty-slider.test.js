// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach } from 'vitest';
import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DifficultySlider } from '../../src/client/components/DifficultySlider.jsx';

const dir = dirname(fileURLToPath(import.meta.url));

describe('DifficultySlider', () => {
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

  function Harness({ initial = 15, disabled = false }) {
    const [value, setValue] = useState(initial);
    return createElement(DifficultySlider, {
      id: 'test-difficulty',
      value,
      onChange: setValue,
      disabled,
      testIdPrefix: 'test-difficulty',
    });
  }

  async function mount(props) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(Harness, props));
    });
  }

  it('snaps to a named band and updates the DC label', async () => {
    await mount({ initial: 10 });
    expect(container.querySelector('#test-difficulty')?.value).toBe('10');
    expect(container.querySelector('[data-testid="test-difficulty-value"]')?.textContent).toBe('10');
    expect(container.querySelector('[data-testid="test-difficulty-label"]')?.textContent).toBe('Easy');

    await act(async () => {
      container.querySelector('[data-testid="test-difficulty-band-20"]').click();
    });
    expect(container.querySelector('#test-difficulty')?.value).toBe('20');
    expect(container.querySelector('[data-testid="test-difficulty-value"]')?.textContent).toBe('20');
    expect(container.querySelector('[data-testid="test-difficulty-label"]')?.textContent).toBe('Hard');
  });

  it('does not change when disabled', async () => {
    await mount({ initial: 15, disabled: true });
    const slider = container.querySelector('#test-difficulty');
    expect(slider?.disabled).toBe(true);
    await act(async () => {
      container.querySelector('[data-testid="test-difficulty-band-25"]').click();
    });
    expect(slider?.value).toBe('15');
    expect(container.querySelector('[data-testid="test-difficulty-value"]')?.textContent).toBe('15');
  });
});

describe('shared DifficultySlider consumers', () => {
  it('Call for Reaction uses the slider instead of a number input', () => {
    const src = readFileSync(join(dir, '../../src/client/components/EncounterReactionCallForm.jsx'), 'utf8');
    expect(src).toContain('DifficultySlider');
    expect(src).toContain('id="reaction-call-difficulty"');
    expect(src).not.toMatch(/type=["']number["']/);
  });

  it('PreRollBanner keeps the Playwright slider id', () => {
    const src = readFileSync(join(dir, '../../src/client/components/PreRollBanner.jsx'), 'utf8');
    expect(src).toContain('DifficultySlider');
    expect(src).toContain('id="intent-difficulty"');
    expect(src).not.toContain('DifficultyBandTickRow');
  });
});
