// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreRollBanner } from '../../src/client/components/PreRollBanner.jsx';
import { PRE_ROLL_POOL_TEXT_DEBOUNCE_MS } from '../../src/client/lib/pre-roll-intent.js';

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

function BannerHarness() {
  const [advantages, setAdvantages] = useState([]);
  const [disadvantages, setDisadvantages] = useState([]);
  return createElement(PreRollBanner, {
    pending: { displayName: 'Hero Agility', meta: { _traitKey: 'agility' } },
    characterEl: { instanceId: 'c1', name: 'Hero' },
    needsDifficulty: true,
    advantages,
    disadvantages,
    onChangeAdvantages: setAdvantages,
    onChangeDisadvantages: setDisadvantages,
    onProceed: () => {},
    onCancel: () => {},
  });
}

describe('PreRollBanner advantage / disadvantage focus', () => {
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

  async function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(BannerHarness));
    });
  }

  it('focuses the new advantage chip input after Add advantage', async () => {
    await mount();
    const add = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Add advantage'),
    );
    expect(add).toBeTruthy();
    expect(container.textContent).toContain('Before you roll');
    await act(async () => {
      add.click();
    });
    const input = container.querySelector('input[aria-label="Advantage name"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it('focuses the new disadvantage chip input after Add disadvantage', async () => {
    await mount();
    const add = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Add disadvantage'),
    );
    expect(add).toBeTruthy();
    await act(async () => {
      add.click();
    });
    const input = container.querySelector('input[aria-label="Disadvantage name"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it('focuses the newest advantage chip when a second one is added', async () => {
    await mount();
    const add = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Add advantage'),
    );
    await act(async () => {
      add.click();
    });
    await act(async () => {
      add.click();
    });
    const inputs = container.querySelectorAll('input[aria-label="Advantage name"]');
    expect(inputs).toHaveLength(2);
    expect(document.activeElement).toBe(inputs[1]);
  });
});

function setInputValue(input, value) {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  proto.set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PreRollBanner advantage / disadvantage text debounce', () => {
  let container;
  let root;

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

  it('does not revert an in-progress advantage name when the parent snapshot goes stale', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onChangeAdvantages = vi.fn();
    const bannerProps = {
      pending: { displayName: 'Hero Agility', meta: { _traitKey: 'agility' } },
      characterEl: { instanceId: 'c1', name: 'Hero' },
      needsDifficulty: true,
      disadvantages: [],
      onChangeDisadvantages: () => {},
      onProceed: () => {},
      onCancel: () => {},
    };
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        ...bannerProps,
        advantages: [''],
        onChangeAdvantages,
      }));
    });
    const input = container.querySelector('input[aria-label="Advantage name"]');
    expect(input).toBeTruthy();
    await act(async () => {
      setInputValue(input, 'Keen');
    });
    expect(input.value).toBe('Keen');
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        ...bannerProps,
        advantages: [''],
        onChangeAdvantages,
      }));
    });
    expect(input.value).toBe('Keen');
    expect(onChangeAdvantages).not.toHaveBeenCalled();
  });

  it('commits a typed advantage name after the pool-text debounce', async () => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onChangeAdvantages = vi.fn();
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        pending: { displayName: 'Hero Agility', meta: { _traitKey: 'agility' } },
        characterEl: { instanceId: 'c1', name: 'Hero' },
        needsDifficulty: true,
        advantages: [''],
        disadvantages: [],
        onChangeAdvantages,
        onChangeDisadvantages: () => {},
        onProceed: () => {},
        onCancel: () => {},
      }));
    });
    const input = container.querySelector('input[aria-label="Advantage name"]');
    await act(async () => {
      setInputValue(input, 'Keen');
    });
    expect(onChangeAdvantages).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(PRE_ROLL_POOL_TEXT_DEBOUNCE_MS - 1);
    });
    expect(onChangeAdvantages).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onChangeAdvantages).toHaveBeenCalledWith(['Keen']);
  });
});

describe('PreRollBanner player difficulty status', () => {
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

  async function mountPlayer({ difficultyFinalized }) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        pending: { displayName: 'Hero Agility', meta: { _traitKey: 'agility' } },
        characterEl: { instanceId: 'c1', name: 'Hero' },
        needsDifficulty: true,
        isPlayer: true,
        difficultyFinalized,
        onProceed: () => {},
        onCancel: () => {},
      }));
    });
  }

  it('shows a non-button GM... status while waiting for approval', async () => {
    await mountPlayer({ difficultyFinalized: false });
    const status = container.querySelector('[data-testid="preroll-difficulty-lock"]');
    expect(status?.tagName).toBe('SPAN');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toBe('GM...');
    expect(container.querySelector('button[data-testid="preroll-difficulty-lock"]')).toBeNull();
  });

  it('shows a non-button Approved status after the GM locks DC', async () => {
    await mountPlayer({ difficultyFinalized: true });
    const status = container.querySelector('[data-testid="preroll-difficulty-lock"]');
    expect(status?.tagName).toBe('SPAN');
    expect(status?.textContent).toBe('Approved');
    expect([...container.querySelectorAll('button')].some((b) => /Approve|Retract/.test(b.textContent))).toBe(false);
  });
});

describe('PreRollBanner GM difficulty while approved', () => {
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

  it('keeps the slider and bands editable after Approve', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        pending: { displayName: 'Hero Agility', meta: { _traitKey: 'agility' } },
        characterEl: { instanceId: 'c1', name: 'Hero' },
        needsDifficulty: true,
        isPlayer: false,
        difficultyFinalized: true,
        difficulty: 20,
        onProceed: () => {},
        onCancel: () => {},
      }));
    });
    const slider = container.querySelector('#intent-difficulty');
    expect(slider?.disabled).toBe(false);
    const hardBand = container.querySelector('[data-testid="preroll-difficulty-band-25"]');
    expect(hardBand?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="preroll-difficulty-lock"]')?.textContent).toBe('Retract');
  });
});

describe('PreRollBanner read-only observer', () => {
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

  async function mountReadonly(props) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        pending: {
          displayName: 'Hero Agility',
          meta: { _traitKey: 'agility', _deferExperienceToPreRoll: true },
        },
        characterEl: {
          instanceId: 'c1',
          name: 'Hero',
          experiences: [{ name: 'Scout', score: 2 }, { name: 'Diplomat', score: 2 }],
        },
        chips: [
          { label: 'Rally' },
          { label: 'Cloaked' },
          { label: 'I moved this turn', _advantageTriggerChip: true },
        ],
        selectedChips: [true, false, true],
        advantages: ['Keen'],
        disadvantages: [],
        needsDifficulty: true,
        isPlayer: true,
        readOnly: true,
        onProceed: () => {},
        onCancel: () => {},
        ...props,
      }));
    });
  }

  it('shows only turned-on chips and hides empty sections and actions', async () => {
    await mountReadonly();
    expect(container.querySelector('[data-testid="preroll-banner"]')?.getAttribute('data-readonly')).toBe('true');
    expect(container.textContent).toContain('Before the roll');
    expect(container.textContent).not.toContain('Before you roll');
    expect(container.textContent).toContain('Rally');
    expect(container.textContent).not.toContain('Cloaked');
    expect(container.textContent).toContain('I moved this turn');
    expect(container.textContent).toContain('Keen');
    expect(container.textContent).not.toContain('Experience');
    expect(container.textContent).not.toContain('Target');
    expect(container.textContent).toContain('Advantage / Disadvantage');
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Proceed'))).toBe(false);
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Cancel'))).toBe(false);
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Add advantage'))).toBe(false);
    expect(container.querySelector('[data-testid="preroll-private-checkbox"]')).toBeNull();
  });

  it('omits the advantage section when no chips or pool names are on', async () => {
    await mountReadonly({
      chips: [{ label: 'Rally' }],
      selectedChips: [false],
      advantages: [''],
      disadvantages: [],
    });
    expect(container.textContent).not.toContain('Rally');
    expect(container.textContent).not.toContain('Advantage / Disadvantage');
  });

  it('shows only the selected experience chip', async () => {
    await mountReadonly({
      experienceIndex: 0,
      chips: [],
      selectedChips: [],
      advantages: [],
    });
    expect(container.textContent).toContain('Experience');
    expect(container.textContent).toContain('Scout');
    expect(container.textContent).not.toContain('Diplomat');
  });

  it('shows a Help toggle with the default label on a read-only observer card', async () => {
    const onHelpChange = vi.fn();
    await mountReadonly({
      chips: [],
      selectedChips: [],
      advantages: [],
      helpViewer: { role: 'player', uid: 'player-b', email: 'b@example.com' },
      activeElements: [
        { instanceId: 'c1', elementType: 'character', name: 'Hero' },
        {
          instanceId: 'c2',
          elementType: 'character',
          name: 'Beau',
          hope: 3,
          maxHope: 6,
          assignedPlayerUid: 'player-b',
          assignedPlayerEmail: 'b@example.com',
        },
      ],
      onHelpChange,
    });
    const toggle = container.querySelector('[data-testid="preroll-help-toggle"]');
    expect(toggle).toBeTruthy();
    expect(container.textContent).toContain('Help an Ally');
    await act(async () => {
      toggle.click();
    });
    expect(onHelpChange).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'c2',
      active: true,
      label: 'Beau helps',
    }));
  });

  it('renders an existing help chip and hides the block on a reaction', async () => {
    await mountReadonly({
      chips: [],
      selectedChips: [],
      advantages: [],
      helps: [{ instanceId: 'c2', label: 'Beau helps', hopeCost: 1, die: 'd6' }],
      helpViewer: { role: 'player', uid: 'player-a', email: 'a@example.com' },
      activeElements: [
        { instanceId: 'c1', elementType: 'character', name: 'Hero' },
        { instanceId: 'c2', elementType: 'character', name: 'Beau', hope: 3 },
      ],
    });
    expect(container.querySelector('[data-testid="preroll-help-row-c2"]')?.textContent).toContain('Beau helps');
    expect(container.querySelector('[data-testid="preroll-help-toggle"]')).toBeNull();

    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(PreRollBanner, {
        pending: { displayName: 'Hero Agility', meta: { _isReaction: true } },
        characterEl: { instanceId: 'c1', name: 'Hero' },
        readOnly: true,
        isPlayer: true,
        helps: [{ instanceId: 'c2', label: 'Beau helps' }],
        helpViewer: { role: 'player', uid: 'player-b', email: 'b@example.com' },
        activeElements: [
          { instanceId: 'c1', elementType: 'character', name: 'Hero' },
          {
            instanceId: 'c2',
            elementType: 'character',
            name: 'Beau',
            assignedPlayerUid: 'player-b',
            assignedPlayerEmail: 'b@example.com',
          },
        ],
        onProceed: () => {},
        onCancel: () => {},
      }));
    });
    expect(container.querySelector('[data-testid="preroll-help"]')).toBeNull();
  });
});

