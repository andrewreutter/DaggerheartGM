import { describe, it, expect } from 'vitest';
import { collectPreRollSession } from '../../src/client/lib/collect-pre-roll-session.js';

const twoToggleFeatures = [
  {
    name: 'First Toggle',
    chips: [{ placement: 'preroll', label: 'First Toggle', isToggle: true }],
  },
  {
    name: 'Second Toggle',
    chips: [{ placement: 'preroll', label: 'Second Toggle', isToggle: true }],
  },
];

function characterWithToggles(instanceId = 'char-1') {
  return {
    instanceId,
    elementType: 'character',
    name: 'Tester',
    hope: 3,
    maxHope: 6,
    activeFeatures: twoToggleFeatures,
  };
}

function collectTwice(characterEl, meta) {
  const args = {
    rollText: 'Tester Agility [d12] [d12]',
    displayName: 'Tester Agility',
    rollMeta: meta,
    characterEl,
    isPlayer: true,
    updateActiveElement: () => {},
    wrappedPartyCharacters: [],
    system: {},
    srdData: null,
    activeElements: [characterEl],
    resolveOriginFeatureDescriptor: () => null,
    resolveClassFeatureDescriptor: () => null,
    resolveWeaponTagDescriptor: () => null,
  };
  return [collectPreRollSession(args), collectPreRollSession(args)];
}

describe('collectPreRollSession', () => {
  it('produces a stable chip list (labels and order) across open and hydrate', () => {
    const el = characterWithToggles();
    const [a, b] = collectTwice(el, { _traitKey: 'agility', _intentPanelForActionRoll: true });
    const labelsA = a.chips.map((c) => c.label || c._featureName);
    const labelsB = b.chips.map((c) => c.label || c._featureName);
    expect(labelsA).toEqual(['First Toggle', 'Second Toggle']);
    expect(labelsB).toEqual(labelsA);
    expect(a.chips.some((c) => c._difficultyChip)).toBe(false);
  });

  it('marks needsDifficulty for a non-attack action roll and not for an attack', () => {
    const el = characterWithToggles();
    const [trait] = collectTwice(el, { _traitKey: 'agility', _intentPanelForActionRoll: true });
    const [attack] = collectTwice(el, {
      _traitKey: 'agility',
      _intentPanelForActionRoll: true,
      _weaponRangeFt: 5,
    });
    expect(trait.needsDifficulty).toBe(true);
    expect(attack.needsDifficulty).toBe(false);
  });

  it('does not treat a GM-called reaction as a difficulty roll', () => {
    const el = characterWithToggles();
    const [reaction] = collectTwice(el, {
      _traitKey: 'agility',
      _intentPanelForActionRoll: true,
      _reactionCallRollDbId: 9,
    });
    expect(reaction.needsDifficulty).toBe(false);
  });
});
