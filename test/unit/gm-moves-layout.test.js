import { describe, it, expect } from 'vitest';
import {
  encounterSourceOrder,
  livingAdversaryCardKeys,
  sortGmMovesBySourceOrder,
  tokenOverlapsViewportFt,
  inCameraAdversaryCardKeys,
  partitionGmMovesByCamera,
  arrangeGmMovesSection,
  pickTallestGmSection,
} from '../../src/client/lib/gm-moves-layout.js';

const vp = { x: 0, y: 0, width: 50, height: 50, mapId: 'm-1' };

function adv({ id, instanceId, tokenX = null, tokenY = null, mapId = 'm-1', currentHp = 4, hp_max = 4 }) {
  return { elementType: 'adversary', id, instanceId, name: id, tokenX, tokenY, mapId, currentHp, hp_max };
}

function env({ instanceId, name }) {
  return { elementType: 'environment', instanceId, name };
}

describe('encounterSourceOrder', () => {
  it('lists environments first (activeElements order), then adversary groups in first-seen order', () => {
    const elements = [
      adv({ id: 'goblin', instanceId: 'g1' }),
      env({ instanceId: 'cave', name: 'Cave' }),
      adv({ id: 'ogre', instanceId: 'o1' }),
      env({ instanceId: 'woods', name: 'Woods' }),
      adv({ id: 'goblin', instanceId: 'g2' }),
    ];
    expect(encounterSourceOrder(elements)).toEqual(['cave', 'woods', 'goblin', 'ogre']);
  });

  it('omits adversary types that are only reserved for the current party', () => {
    const elements = [
      env({ instanceId: 'cave', name: 'Cave' }),
      adv({ id: 'reaper', instanceId: 'r1' }),
      { ...adv({ id: 'wraith', instanceId: 'w1' }), minPartySize: 5 },
    ];
    expect(encounterSourceOrder(elements)).toEqual(['cave', 'reaper']);
    expect([...livingAdversaryCardKeys(elements)]).toEqual(['reaper']);
  });
});

describe('sortGmMovesBySourceOrder', () => {
  it('orders rows to match Encounter sources and keeps same-source order', () => {
    const features = [
      { name: 'Smash', cardKey: 'ogre' },
      { name: 'Echo', cardKey: 'cave' },
      { name: 'Stab', cardKey: 'goblin' },
      { name: 'Howl', cardKey: 'woods' },
      { name: 'Bite', cardKey: 'goblin' },
    ];
    const sorted = sortGmMovesBySourceOrder(features, ['cave', 'woods', 'goblin', 'ogre']);
    expect(sorted.map((f) => f.name)).toEqual(['Echo', 'Howl', 'Stab', 'Bite', 'Smash']);
  });
});

describe('tokenOverlapsViewportFt', () => {
  it('treats unplaced tokens and other-map tokens as out of view', () => {
    expect(tokenOverlapsViewportFt({ tokenX: null, tokenY: null, mapId: 'm-1' }, vp)).toBe(false);
    expect(tokenOverlapsViewportFt({ tokenX: 10, tokenY: 10, mapId: 'm-other' }, vp)).toBe(false);
  });

  it('counts a default 5×5 token whose footprint overlaps the viewport', () => {
    expect(tokenOverlapsViewportFt({ tokenX: 48, tokenY: 48, mapId: 'm-1' }, vp)).toBe(true);
    expect(tokenOverlapsViewportFt({ tokenX: 50, tokenY: 50, mapId: 'm-1' }, vp)).toBe(false);
    expect(tokenOverlapsViewportFt({ tokenX: -4, tokenY: 10, mapId: 'm-1' }, vp)).toBe(true);
    expect(tokenOverlapsViewportFt({ tokenX: -5, tokenY: 10, mapId: 'm-1' }, vp)).toBe(false);
  });
});

describe('inCameraAdversaryCardKeys', () => {
  it('includes a type when any living instance is in view; ignores defeated and tray tokens', () => {
    const elements = [
      adv({ id: 'goblin', instanceId: 'g1', tokenX: 10, tokenY: 10 }),
      adv({ id: 'goblin', instanceId: 'g2', tokenX: null, tokenY: null }),
      adv({ id: 'ogre', instanceId: 'o1', tokenX: 10, tokenY: 10, currentHp: 0 }),
      adv({ id: 'ogre', instanceId: 'o2', tokenX: null, tokenY: null, currentHp: 4 }),
      adv({ id: 'wolf', instanceId: 'w1', tokenX: 200, tokenY: 200 }),
    ];
    expect([...inCameraAdversaryCardKeys(elements, vp)].sort()).toEqual(['goblin']);
  });
});

describe('partitionGmMovesByCamera', () => {
  it('keeps everything in view when the viewport is unknown', () => {
    const features = [{ cardKey: 'goblin' }, { cardKey: 'cave' }];
    const { inView, offCamera } = partitionGmMovesByCamera(features, {
      inViewAdvKeys: new Set(),
      adversaryCardKeys: new Set(['goblin']),
      viewportKnown: false,
    });
    expect(inView).toEqual(features);
    expect(offCamera).toEqual([]);
  });

  it('tucks only off-camera adversary sources; environments stay in view', () => {
    const features = [
      { name: 'Echo', cardKey: 'cave' },
      { name: 'Stab', cardKey: 'goblin' },
      { name: 'Smash', cardKey: 'ogre' },
    ];
    const { inView, offCamera } = partitionGmMovesByCamera(features, {
      inViewAdvKeys: new Set(['goblin']),
      adversaryCardKeys: new Set(['goblin', 'ogre']),
      viewportKnown: true,
    });
    expect(inView.map((f) => f.name)).toEqual(['Echo', 'Stab']);
    expect(offCamera.map((f) => f.name)).toEqual(['Smash']);
  });
});

describe('arrangeGmMovesSection', () => {
  it('sorts by Encounter order then partitions off-camera adversaries', () => {
    const elements = [
      adv({ id: 'ogre', instanceId: 'o1', tokenX: null, tokenY: null }),
      env({ instanceId: 'cave', name: 'Cave' }),
      adv({ id: 'goblin', instanceId: 'g1', tokenX: 10, tokenY: 10 }),
    ];
    const features = [
      { name: 'Smash', cardKey: 'ogre' },
      { name: 'Stab', cardKey: 'goblin' },
      { name: 'Echo', cardKey: 'cave' },
    ];
    const arranged = arrangeGmMovesSection(features, {
      sourceOrder: encounterSourceOrder(elements),
      inViewAdvKeys: inCameraAdversaryCardKeys(elements, vp),
      adversaryCardKeys: livingAdversaryCardKeys(elements),
      viewportKnown: true,
    });
    expect(arranged.inView.map((f) => f.name)).toEqual(['Echo', 'Stab']);
    expect(arranged.offCamera.map((f) => f.name)).toEqual(['Smash']);
  });
});

describe('pickTallestGmSection', () => {
  it('prefers Fear Actions over Actions on ties and when both equal the max', () => {
    expect(pickTallestGmSection(1, 3, 3)).toBe('fear');
    expect(pickTallestGmSection(0, 2, 2)).toBe('fear');
    expect(pickTallestGmSection(5, 5, 5)).toBe('pr');
    expect(pickTallestGmSection(1, 4, 2)).toBe('actions');
    expect(pickTallestGmSection(1, 2, 4)).toBe('fear');
  });
});
