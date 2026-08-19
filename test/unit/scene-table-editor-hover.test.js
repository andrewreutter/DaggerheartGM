// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../src/client/components/BattleMap.jsx', () => ({
  BattleMap: () => null,
}));

vi.mock('../../src/client/components/modals/ItemPickerModal.jsx', () => ({
  ItemPickerModal: () => null,
}));

vi.mock('../../src/client/components/features/FeatureSourceModal.jsx', () => ({
  FeatureSourceModal: () => null,
}));

import { SceneTableEditor } from '../../src/client/components/forms/SceneTableEditor.jsx';

function click(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.click();
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
      {
        instanceId: 'note-1',
        elementType: 'note',
        id: 'note-1',
        name: 'Secret door',
        body: 'Behind the **tapestry**.',
        visibility: 'gm',
      },
    ],
    sessionCountdowns: [
      {
        id: 'cd-1',
        label: 'Ritual clock',
        kind: 'progress',
        start: 8,
        current: 5,
        visibility: 'players',
        autoStandard: false,
        autoDynamic: true,
      },
    ],
  };
}

describe('SceneTableEditor encounter click-to-pin overlays', () => {
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

  it('opens the shared environment detail overlay on card click, not hover', async () => {
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
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeNull();

    await act(async () => {
      click(card);
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

  it('toggles the environment overlay closed on a second card click', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-environment-card"]');
    await act(async () => {
      click(card);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeTruthy();

    await act(async () => {
      click(card);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeNull();
  });

  it('opens the shared adversary detail overlay on type-card click', async () => {
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
      click(typeCard);
    });

    const overlay = document.querySelector('[data-testid="encounter-tracker-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('Bear');
    expect(overlay.textContent).toContain('Difficulty');
    expect(overlay.textContent).toContain('14');
    expect(overlay.textContent).not.toContain('Edit');
  });

  it('opens the note editor overlay on card click', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-note-card"]');
    expect(card).toBeTruthy();
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeNull();

    await act(async () => {
      click(card);
    });

    const overlay = document.querySelector('[data-testid="encounter-tracker-overlay"]');
    expect(overlay).toBeTruthy();
    const titleInput = overlay.querySelector('input[placeholder="Short label"]');
    expect(titleInput).toBeTruthy();
    expect(titleInput.value).toBe('Secret door');
    const bodyField = overlay.querySelector('textarea[placeholder="Note text…"]');
    expect(bodyField).toBeTruthy();
    expect(bodyField.value).toContain('tapestry');
    expect(overlay.textContent).toContain('GM only (hidden from players)');
  });

  it('does not close the note overlay when the card eye is clicked', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-note-card"]');
    await act(async () => {
      click(card);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeTruthy();

    const eye = card.querySelector('button[aria-label="Show to players"]');
    expect(eye).toBeTruthy();
    await act(async () => {
      click(eye);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeTruthy();
  });

  it('opens the countdown editor overlay with the DC chart on card click', async () => {
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange: vi.fn(),
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-countdown-card"]');
    expect(card).toBeTruthy();

    await act(async () => {
      click(card);
    });

    const overlay = document.querySelector('[data-testid="encounter-tracker-overlay"]');
    expect(overlay).toBeTruthy();
    const nameInput = overlay.querySelector('input[placeholder="Label"]');
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe('Ritual clock');
    expect(overlay.textContent).toContain('Progress');
    expect(overlay.textContent).toContain('Visible to players');
    expect(overlay.textContent).toContain('Current value');
    expect(overlay.textContent).toContain('Dynamic DC chart');
    expect(overlay.textContent).toContain('Critical');
    expect(overlay.textContent).toContain('Success · Hope higher');
    expect(overlay.textContent).toContain('Prog −');
    expect(overlay.textContent).toContain('Cons −');
  });

  it('does not close the countdown overlay when a stepper is clicked', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange,
        }),
      );
    });

    const card = container.querySelector('[data-testid="encounter-countdown-card"]');
    await act(async () => {
      click(card);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeTruthy();

    const inc = card.querySelector('button[aria-label="Increase countdown"]');
    expect(inc).toBeTruthy();
    await act(async () => {
      click(inc);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it('does not open the overlay when the adversary header + is clicked', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(SceneTableEditor, {
          value: sceneWithEnvAndBear(),
          onChange,
        }),
      );
    });

    const addBtn = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('title') === 'Add one more',
    );
    expect(addBtn).toBeTruthy();
    await act(async () => {
      click(addBtn);
    });
    expect(document.querySelector('[data-testid="encounter-tracker-overlay"]')).toBeNull();
    expect(onChange).toHaveBeenCalled();
  });
});
