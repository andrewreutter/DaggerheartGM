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

function sceneWithBear() {
  return {
    name: 'Ambush',
    activeElements: [
      {
        instanceId: 'bear-1',
        elementType: 'adversary',
        id: 'srd-adv-bear',
        name: 'Bear',
        role: 'bruiser',
        currentHp: 4,
        hp_max: 4,
        attack: { name: 'Claw', modifier: 2, range: 'Melee', damage: 'd8+2', trait: 'phy' },
      },
    ],
  };
}

describe('SceneTableEditor GM Moves', () => {
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
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('opens a preview overlay with the scene adversary attack and role move', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const trigger = container.querySelector('[data-testid="gm-moves-trigger"]');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toMatch(/GM Moves/);

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const title = container.querySelector('#scene-gm-moves-title');
    expect(title?.textContent).toMatch(/GM Moves/);
    expect(container.textContent).toContain('Claw');
    expect(container.textContent).toContain('Bruiser Move');
    expect(container.textContent).toContain('Default Moves');
  });

  it('shows a party-size dropdown defaulting to 4 PCs, not the live table count', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithBear(),
          onChange,
        }),
      );
    });

    const select = container.querySelector('select[aria-label="Number of PCs for this scene"]');
    expect(select).toBeTruthy();
    expect(select.value).toBe('4');
    expect(container.textContent).not.toMatch(/· 1 PC\b/);

    await act(async () => {
      select.value = '6';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)[0];
    expect(next.partySize).toBe(6);
  });

  it('shows a party-tier dropdown defaulting to Tier 1', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithBear(),
          onChange,
        }),
      );
    });

    const select = container.querySelector('select[aria-label="Party tier for this scene"]');
    expect(select).toBeTruthy();
    expect(select.value).toBe('1');
    expect(container.textContent).toMatch(/of/);

    await act(async () => {
      select.value = '3';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)[0];
    expect(next.partyTier).toBe(3);
  });
});
