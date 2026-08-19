// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionCountdownEditorModal } from '../../src/client/components/modals/SessionCountdownEditorModal.jsx';
import { normalizeSessionCountdownEntry } from '../../src/client/lib/session-countdowns.js';
import {
  buildTrackedSessionEntryFromFeature,
  buildLinkedPairFromFeatureCountdowns,
} from '../../src/client/components/SessionCountdownsPanel.jsx';
import { parseAllCountdownValues } from '../../src/client/lib/helpers.js';

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

    expect(document.body.querySelector('input[aria-label="Start"]')?.value).toBe('6');
    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Starting value')).toBe(false);
    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Last roll')).toBe(false);
    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Current value')).toBe(true);

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
        looping: 'none',
        startFormula: '6',
        startPending: false,
        start: 6,
        current: 4,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves looping and startFormula from the hydrated row', async () => {
    vi.useFakeTimers();
    const onApplyPatch = vi.fn();
    const row = normalizeSessionCountdownEntry({
      id: 'r2',
      label: 'Tide',
      kind: 'standard',
      start: 3,
      current: 1,
      looping: 'increasing',
      startFormula: '1d4',
      startPending: false,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SessionCountdownEditorModal, {
          open: true,
          row,
          onClose: vi.fn(),
          onApplyPatch,
          onRemove: vi.fn(),
        }),
      );
    });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Last roll')).toBe(true);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Save');
    await act(async () => {
      saveBtn.click();
    });

    expect(onApplyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        looping: 'increasing',
        startFormula: '1d4',
        startPending: false,
        start: 3,
        current: 1,
      }),
    );
  });

  it('hides last-roll and current while a dice start is pending', async () => {
    vi.useFakeTimers();
    const row = normalizeSessionCountdownEntry({
      id: 'r3',
      label: 'Pending',
      startFormula: '1d4',
      startPending: true,
      start: 0,
      current: 0,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SessionCountdownEditorModal, {
          open: true,
          row,
          onClose: vi.fn(),
          onApplyPatch: vi.fn(),
          onRemove: vi.fn(),
        }),
      );
    });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(document.body.querySelector('input[aria-label="Start"]')?.value).toBe('1d4');
    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Last roll')).toBe(false);
    expect(Array.from(document.body.querySelectorAll('span')).some((el) => el.textContent === 'Current value')).toBe(false);
  });
});

describe('buildTrackedSessionEntryFromFeature', () => {
  it('copies looping + startFormula and sets startPending for dice', () => {
    const parsed = parseAllCountdownValues('Countdown (Loop 1d4)')[0];
    const entry = buildTrackedSessionEntryFromFeature({
      feature: { name: 'Necrotic Tide', cardKey: 'adv', featureKey: 'feat' },
      cd: parsed,
      cdIdx: 0,
      sourceName: 'Necromancer',
    });
    expect(entry.looping).toBe('reset');
    expect(entry.startFormula).toBe('1d4');
    expect(entry.startPending).toBe(true);
    expect(entry.start).toBe(0);
    expect(entry.current).toBe(0);
  });

  it('linked pair copies formula fields onto both rows', () => {
    const cds = parseAllCountdownValues('Progress Countdown (4) Consequence Countdown (Loop 1d6)');
    const pair = buildLinkedPairFromFeatureCountdowns({
      feature: { name: 'Pair', cardKey: 'c', featureKey: 'f' },
      cds,
      sourceName: 'Scene',
    });
    expect(pair).toHaveLength(2);
    expect(pair[0].start).toBe(4);
    expect(pair[0].startPending).toBe(false);
    expect(pair[1].looping).toBe('reset');
    expect(pair[1].startFormula).toBe('1d6');
    expect(pair[1].startPending).toBe(true);
    expect(pair[0].linkedGroupId).toBe(pair[1].linkedGroupId);
  });
});
