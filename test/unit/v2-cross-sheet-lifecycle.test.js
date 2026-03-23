import { describe, it, expect } from 'vitest';
import {
  ownedCardChipActionLoopDescription,
  activateV2OwnedCardChip,
} from '../../src/client/lib/v2-cross-sheet-lifecycle.js';
import v2registry from '../../src/features-v2/registry.js';
import { Wings } from '../../src/features-v2/ancestries/Faerie.js';
import { mockCharacter } from './features-v2/helpers.js';

const registryWithTestFaerie = {
  ...v2registry,
  ancestries: {
    ...v2registry.ancestries,
    'srd-anc-test-faerie': {
      name: 'Faerie',
      features: [Wings],
    },
  },
};

describe('ownedCardChipActionLoopDescription', () => {
  it('returns full registry description when present (card-chip action banner body)', () => {
    const full =
      'Any time you would be Hidden, you are instead Cloaked. In addition to the benefits of the Hidden condition, while Cloaked you remain unseen if you are stationary when an adversary moves to where they would normally see you. After you make an attack or end a move within line of sight of an adversary, you are no longer Cloaked.';
    expect(
      ownedCardChipActionLoopDescription({ name: 'Vodalus' }, 'Cloaked', {
        name: 'Cloaked',
        description: full,
      }),
    ).toBe(full);
  });

  it('falls back to "Name used Chip" when no description on feature', () => {
    expect(ownedCardChipActionLoopDescription({ name: 'A' }, 'Thing', { name: 'Thing' })).toBe(
      'A used Thing.',
    );
  });
});

describe('activateV2OwnedCardChip', () => {
  it('sets actionLoop title to Feature (On) or (Off) for toggle card chips', () => {
    const charOff = mockCharacter({ instanceId: 'c1', ancestryIds: ['srd-anc-test-faerie'] });
    const rOff = activateV2OwnedCardChip(
      charOff,
      'Wings',
      { name: 'Wings' },
      [charOff],
      registryWithTestFaerie,
      {},
    );
    const synOff = rOff.mutations?.filter((m) => m.type === 'actionLoop').pop();
    expect(synOff?.payload?.title).toBe('Wings (On)');

    const charOn = mockCharacter({
      instanceId: 'c2',
      ancestryIds: ['srd-anc-test-faerie'],
      featureState: { Wings: { '_v2t:Wings::Wings::card': true } },
    });
    const rOn = activateV2OwnedCardChip(
      charOn,
      'Wings',
      { name: 'Wings' },
      [charOn],
      registryWithTestFaerie,
      {},
    );
    const synOn = rOn.mutations?.filter((m) => m.type === 'actionLoop').pop();
    expect(synOn?.payload?.title).toBe('Wings (Off)');
  });

  it('Wings of Light — Pick up and carry does not duplicate actionLoop (onUse already narrates)', () => {
    const char = mockCharacter({
      instanceId: 'ws-pickup',
      name: 'SHAMUJ',
      classId: 'srd-cls-seraph',
      subclassId: 'srd-sub-winged-sentinel',
      featureState: { WingedSentinel: { '_v2t:Wings of Light::Flying::card': true } },
      currentStress: 0,
      maxStress: 6,
    });
    const r = activateV2OwnedCardChip(
      char,
      'Wings of Light',
      { name: 'Pick up and carry' },
      [char],
      v2registry,
      {},
    );
    const loops = r.mutations?.filter((m) => m.type === 'actionLoop') ?? [];
    expect(loops).toHaveLength(1);
    const desc = loops[0]?.payload?.description ?? '';
    expect(desc).toContain('Pick up and carry a willing creature');
    expect(desc).not.toContain('While flying, you can do the following');
  });
});
