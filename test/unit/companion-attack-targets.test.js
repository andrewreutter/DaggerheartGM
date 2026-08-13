import { describe, it, expect, vi } from 'vitest';
import {
  collectCompanionDamageTargets,
  filterPartyDamageTargetsByIds,
  getAdversaryAttackTargetsWithinRangeFt,
  getAdversaryAttackTargetsWithinRangeOfAny,
  getCompanionsWithinRangeFt,
  isAdversaryAttackPartyTarget,
  isCompanionStressMaxed,
  markCompanionHitStress,
  resolveCompanionRangeElement,
} from '../../src/client/lib/companion-attack-targets.js';
import { getCharactersWithinRangeFt } from '../../src/client/lib/map-range.js';

const ranger = {
  elementType: 'character',
  instanceId: 'ranger-1',
  name: 'Kestrel',
  subclassId: 'srd-sub-beastbound',
  tokenX: 0,
  tokenY: 0,
  mapId: 'map-a',
  companion: {
    name: 'Wolf',
    evasion: 12,
    maxStress: 3,
    currentStress: 1,
    tokenSizeWidth: 1,
    tokenSizeLength: 1,
  },
};

const companionToken = {
  elementType: 'boardToken',
  instanceId: 'comp-1',
  parentInstanceId: 'ranger-1',
  virtualTokenId: 'beastbound-companion',
  tokenKind: 'companion',
  label: 'Wolf',
  tokenX: null,
  tokenY: null,
  mapId: null,
};

const adversary = {
  elementType: 'adversary',
  instanceId: 'adv-1',
  name: 'Goblin',
  tokenX: 5,
  tokenY: 0,
  mapId: 'map-a',
};

describe('isAdversaryAttackPartyTarget', () => {
  it('accepts character and companion types', () => {
    expect(isAdversaryAttackPartyTarget({ type: 'character' })).toBe(true);
    expect(isAdversaryAttackPartyTarget({ type: 'companion' })).toBe(true);
    expect(isAdversaryAttackPartyTarget('companion')).toBe(true);
    expect(isAdversaryAttackPartyTarget({ type: 'adversary' })).toBe(false);
  });
});

describe('isCompanionStressMaxed', () => {
  it('is true when marked stress is at max', () => {
    expect(isCompanionStressMaxed({ maxStress: 3, currentStress: 3 })).toBe(true);
    expect(isCompanionStressMaxed({ maxStress: 3, currentStress: 2 })).toBe(false);
  });
});

describe('collectCompanionDamageTargets', () => {
  it('lists living companions as type companion using the boardToken instanceId', () => {
    const targets = collectCompanionDamageTargets([ranger, companionToken, adversary]);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      instanceId: 'comp-1',
      parentInstanceId: 'ranger-1',
      name: 'Wolf',
      type: 'companion',
      evasion: 12,
      maxStress: 3,
      currentStress: 1,
    });
  });

  it('omits companions with all stress marked', () => {
    const down = {
      ...ranger,
      companion: { ...ranger.companion, currentStress: 3 },
    };
    expect(collectCompanionDamageTargets([down, companionToken])).toEqual([]);
  });

  it('omits boardTokens whose parent has no companion data', () => {
    expect(collectCompanionDamageTargets([{ ...ranger, companion: null }, companionToken])).toEqual([]);
  });
});

describe('resolveCompanionRangeElement', () => {
  it('uses the placed companion token when present', () => {
    const placed = { ...companionToken, tokenX: 40, tokenY: 10, mapId: 'map-a' };
    const rangeEl = resolveCompanionRangeElement(placed, ranger);
    expect(rangeEl).toMatchObject({ tokenX: 40, tokenY: 10, mapId: 'map-a' });
  });

  it('falls back to the ranger position when the companion is in the tray', () => {
    const rangeEl = resolveCompanionRangeElement(companionToken, ranger);
    expect(rangeEl).toMatchObject({ tokenX: 0, tokenY: 0, mapId: 'map-a' });
  });

  it('returns null when neither companion nor ranger is on the map', () => {
    const trayRanger = { ...ranger, tokenX: null, tokenY: null };
    expect(resolveCompanionRangeElement(companionToken, trayRanger)).toBeNull();
  });
});

describe('getCompanionsWithinRangeFt / adversary attack targets', () => {
  it('includes an unplaced companion that shares the ranger\'s space in melee of the attacker', () => {
    const inRange = getCompanionsWithinRangeFt([ranger, companionToken, adversary], 'adv-1', 5);
    expect(inRange.map((t) => t.instanceId)).toEqual(['comp-1']);
  });

  it('excludes a companion placed beyond the attack range even if the ranger is in range', () => {
    const farCompanion = { ...companionToken, tokenX: 80, tokenY: 0, mapId: 'map-a' };
    const inRange = getCompanionsWithinRangeFt([ranger, farCompanion, adversary], 'adv-1', 5);
    expect(inRange).toEqual([]);
  });

  it('does not treat companions as characters in getCharactersWithinRangeFt', () => {
    const chars = getCharactersWithinRangeFt([ranger, companionToken, adversary], 'adv-1', 30);
    expect(chars.map((c) => c.instanceId)).toEqual(['ranger-1']);
  });

  it('unions characters and companions for adversary attacks', () => {
    const targets = getAdversaryAttackTargetsWithinRangeFt(
      [ranger, companionToken, adversary],
      'adv-1',
      5,
    );
    expect(targets.map((t) => t.instanceId).sort()).toEqual(['comp-1', 'ranger-1']);
  });

  it('unions across multiple attacker instances', () => {
    const farAdv = { ...adversary, instanceId: 'adv-2', tokenX: 80, tokenY: 0 };
    const farCompanion = { ...companionToken, tokenX: 78, tokenY: 0, mapId: 'map-a' };
    const targets = getAdversaryAttackTargetsWithinRangeOfAny(
      [ranger, farCompanion, adversary, farAdv],
      ['adv-1', 'adv-2'],
      5,
    );
    expect(targets.map((t) => t.instanceId).sort()).toEqual(['comp-1', 'ranger-1']);
  });
});

describe('filterPartyDamageTargetsByIds', () => {
  it('keeps character and companion rows whose ids are in range', () => {
    const damageTargets = [
      { instanceId: 'ranger-1', type: 'character', name: 'Kestrel' },
      { instanceId: 'comp-1', type: 'companion', name: 'Wolf' },
      { instanceId: 'adv-1', type: 'adversary', name: 'Goblin' },
    ];
    const filtered = filterPartyDamageTargetsByIds(damageTargets, [{ instanceId: 'comp-1' }]);
    expect(filtered).toEqual([damageTargets[1]]);
  });
});

describe('markCompanionHitStress', () => {
  it('marks exactly one stress on the parent companion bag', () => {
    const update = vi.fn();
    const result = markCompanionHitStress(ranger, update);
    expect(result).toEqual({ marked: 1, currentStress: 2 });
    expect(update).toHaveBeenCalledWith('ranger-1', {
      companion: { ...ranger.companion, currentStress: 2 },
    });
  });

  it('no-ops when companion stress is already maxed', () => {
    const update = vi.fn();
    const parent = { ...ranger, companion: { ...ranger.companion, currentStress: 3 } };
    expect(markCompanionHitStress(parent, update)).toEqual({ marked: 0, currentStress: 3 });
    expect(update).not.toHaveBeenCalled();
  });
});
