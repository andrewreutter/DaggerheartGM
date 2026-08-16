import { describe, it, expect } from 'vitest';
import {
  isAdversaryVisibleToPlayers,
  filterAdversariesVisibleToPlayers,
  canRevealAnyAdversaries,
  canHideAnyAdversaries,
  redactHiddenAdversariesForAudience,
} from '../../src/client/lib/adversary-player-visibility.js';

function adv(overrides = {}) {
  return { instanceId: 'a1', elementType: 'adversary', name: 'Rat', ...overrides };
}

describe('isAdversaryVisibleToPlayers', () => {
  it('treats missing visibleToPlayers as visible', () => {
    expect(isAdversaryVisibleToPlayers(adv())).toBe(true);
    expect(isAdversaryVisibleToPlayers(adv({ visibleToPlayers: undefined }))).toBe(true);
  });

  it('treats true as visible and false as hidden', () => {
    expect(isAdversaryVisibleToPlayers(adv({ visibleToPlayers: true }))).toBe(true);
    expect(isAdversaryVisibleToPlayers(adv({ visibleToPlayers: false }))).toBe(false);
  });
});

describe('filterAdversariesVisibleToPlayers', () => {
  it('keeps non-adversaries and visible adversaries', () => {
    const els = [
      { instanceId: 'c1', elementType: 'character' },
      adv({ instanceId: 'a1' }),
      adv({ instanceId: 'a2', visibleToPlayers: false }),
      { instanceId: 'n1', elementType: 'note' },
    ];
    expect(filterAdversariesVisibleToPlayers(els).map((e) => e.instanceId)).toEqual(['c1', 'a1', 'n1']);
  });
});

describe('canRevealAnyAdversaries / canHideAnyAdversaries', () => {
  it('disables both when the list is empty', () => {
    expect(canRevealAnyAdversaries([])).toBe(false);
    expect(canHideAnyAdversaries([])).toBe(false);
  });

  it('reveal is disabled when every adversary is already visible', () => {
    const list = [adv({ instanceId: 'a1' }), adv({ instanceId: 'a2', visibleToPlayers: true })];
    expect(canRevealAnyAdversaries(list)).toBe(false);
    expect(canHideAnyAdversaries(list)).toBe(true);
  });

  it('hide is disabled when every adversary is already hidden', () => {
    const list = [
      adv({ instanceId: 'a1', visibleToPlayers: false }),
      adv({ instanceId: 'a2', visibleToPlayers: false }),
    ];
    expect(canRevealAnyAdversaries(list)).toBe(true);
    expect(canHideAnyAdversaries(list)).toBe(false);
  });

  it('enables both when at least one adversary would change', () => {
    const list = [
      adv({ instanceId: 'a1' }),
      adv({ instanceId: 'a2', visibleToPlayers: false }),
    ];
    expect(canRevealAnyAdversaries(list)).toBe(true);
    expect(canHideAnyAdversaries(list)).toBe(true);
  });
});

describe('redactHiddenAdversariesForAudience', () => {
  it('returns state unchanged for gm audience', () => {
    const state = {
      elements: [adv({ instanceId: 'a1', visibleToPlayers: false })],
    };
    expect(redactHiddenAdversariesForAudience(state, 'gm')).toBe(state);
  });

  it('removes hidden adversaries from elements for player audience', () => {
    const state = {
      elements: [
        adv({ instanceId: 'a1' }),
        adv({ instanceId: 'a2', visibleToPlayers: false }),
        { instanceId: 'c1', elementType: 'character' },
      ],
    };
    const out = redactHiddenAdversariesForAudience(state, 'player');
    expect(out.elements.map((e) => e.instanceId)).toEqual(['a1', 'c1']);
    expect(out).not.toBe(state);
  });

  it('leaves a player snapshot unchanged when every adversary is visible', () => {
    const state = { elements: [adv({ instanceId: 'a1' })] };
    expect(redactHiddenAdversariesForAudience(state, 'player')).toBe(state);
  });

  it('also redacts activeElements when present', () => {
    const state = {
      activeElements: [adv({ instanceId: 'a1', visibleToPlayers: false })],
    };
    const out = redactHiddenAdversariesForAudience(state, 'player');
    expect(out.activeElements).toEqual([]);
  });
});
