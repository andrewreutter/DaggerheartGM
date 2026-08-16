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

function hover(el) {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
}

function sceneWithEnvAndBear() {
  return {
    name: 'Ambush',
    activeElements: [
      {
        instanceId: 'env-1',
        elementType: 'environment',
        id: 'srd-env-abandoned-grove',
        name: 'Abandoned Grove',
        tier: 1,
        type: 'exploration',
        difficulty: 13,
        description: 'Twisted oaks and quiet rot.',
        impulses: 'Lure travelers off the path',
      },
      {
        instanceId: 'bear-1',
        elementType: 'adversary',
        id: 'srd-adv-bear',
        name: 'Bear',
        role: 'bruiser',
        currentHp: 4,
        hp_max: 4,
        difficulty: 14,
        attack: { name: 'Claw', modifier: 2, range: 'Melee', damage: 'd8+2', trait: 'phy' },
      },
    ],
  };
}

describe('SceneTableEditor encounter hover overlays', () => {
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

  it('opens the shared environment detail overlay on card hover', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-environment-card"]');
    expect(card).toBeTruthy();
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeNull();

    await act(async () => {
      hover(card);
    });

    const overlay = document.querySelector('[data-testid="encounter-tracker-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Abandoned Grove');
    expect(overlay.textContent).toContain('Difficulty');
    expect(overlay.textContent).toContain('13');
    expect(overlay.textContent).toContain('Impulses');
    expect(overlay.textContent).toContain('Lure travelers off the path');
    expect(overlay.textContent).not.toContain('Edit');
  });

  it('opens the shared adversary detail overlay on type-card hover', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const typeCard = [...container.querySelectorAll('.group\\/adv')].find((el) =>
      el.textContent?.includes('Bear'),
    );
    expect(typeCard).toBeTruthy();

    await act(async () => {
      hover(typeCard);
    });

    const overlay = document.querySelector('[data-testid="encounter-tracker-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Bear');
    expect(overlay.textContent).toContain('Difficulty');
    expect(overlay.textContent).toContain('14');
    expect(overlay.textContent).not.toContain('Edit');
  });
});
