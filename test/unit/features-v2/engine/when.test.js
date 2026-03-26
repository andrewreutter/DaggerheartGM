import { describe, it, expect } from 'vitest';
import {
  when,
  isActing,
  isTargeted,
  againstYou,
  anAttackSucceeds,
  youSucceedOnAnAttack,
  againstATargetInMeleeRange,
  againstATargetWithinMeleeRange,
  againstATargetInVeryCloseRange,
  againstATargetWithinVeryCloseRange,
  againstATargetWithinCloseRange,
  againstATargetInCloseRange,
  attackerAndTargetAreInRangeBand,
  attackerAndTargetAreWithinRangeBand,
  rangeBandIndex,
  armorUseCommitted,
  hasDamage,
  hasPhysicalDamage,
  youAreTheActor,
  youDealMinorDamage,
  youDealMajorDamage,
  youDealSevereDamage,
  youTakeMinorDamage,
  youTakeMajorDamage,
  youTakeSevereDamage,
  effectTargetsMe,
  isMajorPendingHpLossEffect,
  isSeverePendingHpLossEffect,
  pendingHpLossToPrimaryTargetEffect,
  isWhen,
  unwrap,
  unwrapAll,
  makeASpellcastRoll,
  actingOnASpellcastRollForMe,
} from '../../../../src/features-v2/engine/when.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTable(meIsActing = false, targets = []) {
  const me = { instanceId: 'char-1', isActing: meIsActing };
  return {
    me,
    action: {
      actor: me,
      targets,
    },
  };
}

// ---------------------------------------------------------------------------
// makeASpellcastRoll
// ---------------------------------------------------------------------------

describe('makeASpellcastRoll', () => {
  it('is true when action is spellcast and trait matches spellcastTrait', () => {
    const me = { instanceId: 'c1', spellcastTrait: 'presence', isActing: true };
    const table = {
      me,
      action: { type: 'spellcast', actor: me, trait: 'Presence', targets: [] },
    };
    expect(makeASpellcastRoll(table)).toBe(true);
  });

  it('is false when action type is trait even if traits match', () => {
    const me = { instanceId: 'c1', spellcastTrait: 'presence', isActing: true };
    const table = {
      me,
      action: { type: 'trait', actor: me, trait: 'Presence', targets: [] },
    };
    expect(makeASpellcastRoll(table)).toBe(false);
  });

  it('is false when spellcast trait does not match action trait', () => {
    const me = { instanceId: 'c1', spellcastTrait: 'presence', isActing: true };
    const table = {
      me,
      action: { type: 'spellcast', actor: me, trait: 'Agility', targets: [] },
    };
    expect(makeASpellcastRoll(table)).toBe(false);
  });
});

describe('actingOnASpellcastRollForMe', () => {
  it('is true when acting and makeASpellcastRoll would be true', () => {
    const me = { instanceId: 'c1', spellcastTrait: 'presence', isActing: true };
    const table = {
      me,
      action: { type: 'spellcast', actor: me, trait: 'Presence', targets: [] },
    };
    expect(actingOnASpellcastRollForMe(table)).toBe(true);
  });

  it('is false when not acting', () => {
    const me = { instanceId: 'c1', spellcastTrait: 'presence', isActing: false };
    const table = {
      me,
      action: { type: 'spellcast', actor: me, trait: 'Presence', targets: [] },
    };
    expect(actingOnASpellcastRollForMe(table)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// when()
// ---------------------------------------------------------------------------

describe('when()', () => {
  it('wraps a value with a single predicate', () => {
    const w = when(() => true, 'hello');
    expect(isWhen(w)).toBe(true);
  });

  it('wraps a value with multiple predicates', () => {
    const w = when(() => true, () => true, { foo: 1 });
    expect(isWhen(w)).toBe(true);
  });

  it('throws when called with fewer than 2 arguments', () => {
    expect(() => when(() => true)).toThrow();
    expect(() => when()).toThrow();
  });

  it('does not modify the wrapped value object identity', () => {
    const obj = { nested: true };
    const w = when(() => true, obj);
    expect(isWhen(w)).toBe(true);
    // The wrapper itself is not the original object
    expect(w).not.toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// isActing
// ---------------------------------------------------------------------------

describe('isActing', () => {
  it('returns true when table.me.isActing is true', () => {
    expect(isActing(makeTable(true))).toBe(true);
  });

  it('returns false when table.me.isActing is false', () => {
    expect(isActing(makeTable(false))).toBe(false);
  });

  it('returns false when table.me is absent', () => {
    expect(isActing({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTargeted
// ---------------------------------------------------------------------------

describe('isTargeted', () => {
  it('returns true when table.me is in action.targets', () => {
    const me = { instanceId: 'char-1', isActing: false };
    const table = { me, action: { targets: [me] } };
    expect(isTargeted(table)).toBe(true);
  });

  it('returns false when table.me is not in action.targets', () => {
    const me = { instanceId: 'char-1' };
    const other = { instanceId: 'char-2' };
    const table = { me, action: { targets: [other] } };
    expect(isTargeted(table)).toBe(false);
  });

  it('returns false when action is undefined', () => {
    const me = { instanceId: 'char-1' };
    expect(isTargeted({ me })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// againstYou
// ---------------------------------------------------------------------------

describe('againstYou', () => {
  it('matches isTargeted', () => {
    const me = { instanceId: 'char-1', isActing: false };
    const t1 = { me, action: { targets: [me] } };
    const t2 = { me, action: { targets: [{ instanceId: 'other' }] } };
    expect(againstYou(t1)).toBe(isTargeted(t1));
    expect(againstYou(t2)).toBe(isTargeted(t2));
  });
});

// ---------------------------------------------------------------------------
// anAttackSucceeds
// ---------------------------------------------------------------------------

describe('anAttackSucceeds', () => {
  it('returns true for successful attack action', () => {
    const table = {
      action: { type: 'attack' },
      rolls: { action: { isSuccess: true } },
    };
    expect(anAttackSucceeds(table)).toBe(true);
  });

  it('returns false when action roll missed', () => {
    const table = {
      action: { type: 'attack' },
      rolls: { action: { isSuccess: false } },
    };
    expect(anAttackSucceeds(table)).toBe(false);
  });

  it('returns false when action is not attack', () => {
    const table = {
      action: { type: 'spell' },
      rolls: { action: { isSuccess: true } },
    };
    expect(anAttackSucceeds(table)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// youSucceedOnAnAttack / map range vs primary target
// ---------------------------------------------------------------------------

describe('youSucceedOnAnAttack', () => {
  it('returns true when me is the actor and the attack succeeded', () => {
    const me = { instanceId: 'a' };
    const table = {
      me,
      action: { type: 'attack', actor: me, target: { instanceId: 'b' } },
      rolls: { action: { isSuccess: true } },
    };
    expect(youSucceedOnAnAttack(table)).toBe(true);
  });

  it('returns false when a different actor is attacking', () => {
    const me = { instanceId: 'a' };
    const other = { instanceId: 'z' };
    const table = {
      me,
      action: { type: 'attack', actor: other, target: me },
      rolls: { action: { isSuccess: true } },
    };
    expect(youSucceedOnAnAttack(table)).toBe(false);
  });
});

describe('rangeBandIndex', () => {
  it('orders melee closest', () => {
    expect(rangeBandIndex('melee')).toBe(0);
    expect(rangeBandIndex('veryFar')).toBe(4);
    expect(rangeBandIndex('unknown')).toBe(-1);
  });
});

describe('attackerAndTargetAreInRangeBand / WithinRangeBand', () => {
  const attacker = (band) => ({ instanceId: 'a', rangeFrom: () => band });
  const target = { instanceId: 'b' };

  it('In: exact band only', () => {
    expect(attackerAndTargetAreInRangeBand(attacker('melee'), target, 'melee')).toBe(true);
    expect(attackerAndTargetAreInRangeBand(attacker('melee'), target, 'veryClose')).toBe(false);
  });

  it('Within: includes closer bands', () => {
    expect(attackerAndTargetAreWithinRangeBand(attacker('melee'), target, 'veryClose')).toBe(true);
    expect(attackerAndTargetAreWithinRangeBand(attacker('veryClose'), target, 'veryClose')).toBe(true);
    expect(attackerAndTargetAreWithinRangeBand(attacker('close'), target, 'veryClose')).toBe(false);
  });
});

describe('againstATargetWithinMeleeRange', () => {
  function tableWithBand(band) {
    const attacker = { instanceId: 'a', rangeFrom: () => band };
    const target = { instanceId: 'b' };
    return { action: { actor: attacker, target } };
  }

  it('is true only for melee map distance', () => {
    expect(againstATargetWithinMeleeRange(tableWithBand('melee'))).toBe(true);
    expect(againstATargetWithinMeleeRange(tableWithBand('veryClose'))).toBe(false);
  });

  it('is false when rangeFrom is null (positions unknown)', () => {
    const attacker = { instanceId: 'a', rangeFrom: () => null };
    const target = { instanceId: 'b' };
    expect(againstATargetWithinMeleeRange({ action: { actor: attacker, target } })).toBe(false);
  });

  it('matches In for melee (no closer band exists)', () => {
    expect(againstATargetInMeleeRange(tableWithBand('melee'))).toBe(
      againstATargetWithinMeleeRange(tableWithBand('melee'))
    );
  });
});

describe('againstATargetWithinVeryCloseRange', () => {
  function tableWithBand(band) {
    const attacker = { instanceId: 'a', rangeFrom: () => band };
    const target = { instanceId: 'b' };
    return { action: { actor: attacker, target } };
  }

  it('includes melee and very close, not close', () => {
    expect(againstATargetWithinVeryCloseRange(tableWithBand('melee'))).toBe(true);
    expect(againstATargetWithinVeryCloseRange(tableWithBand('veryClose'))).toBe(true);
    expect(againstATargetWithinVeryCloseRange(tableWithBand('close'))).toBe(false);
  });

  it('In very close excludes melee', () => {
    expect(againstATargetInVeryCloseRange(tableWithBand('melee'))).toBe(false);
    expect(againstATargetInVeryCloseRange(tableWithBand('veryClose'))).toBe(true);
  });
});

describe('againstATargetWithinCloseRange', () => {
  it('includes bands up to close', () => {
    const attacker = (band) => ({ instanceId: 'a', rangeFrom: () => band });
    const target = { instanceId: 'b' };
    expect(
      againstATargetWithinCloseRange({ action: { actor: attacker('melee'), target } })
    ).toBe(true);
    expect(
      againstATargetWithinCloseRange({ action: { actor: attacker('close'), target } })
    ).toBe(true);
    expect(
      againstATargetWithinCloseRange({ action: { actor: attacker('far'), target } })
    ).toBe(false);
  });

  it('In close excludes melee', () => {
    const attacker = { instanceId: 'a', rangeFrom: () => 'melee' };
    const target = { instanceId: 'b' };
    expect(againstATargetInCloseRange({ action: { actor: attacker, target } })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// armorUseCommitted
// ---------------------------------------------------------------------------

describe('armorUseCommitted', () => {
  it('returns true when useArmorByTargetId is true for the owner', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        useArmorByTargetId: { 'char-1': true },
        effects: [],
      },
    };
    expect(armorUseCommitted(table)).toBe(true);
  });

  it('returns true when a damage effect for the owner has useArmor true', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'char-1' },
            amount: 4,
            useArmor: true,
          },
        ],
      },
    };
    expect(armorUseCommitted(table)).toBe(true);
  });

  it('returns false when neither map nor damage line indicates commitment', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 4, useArmor: false },
        ],
      },
    };
    expect(armorUseCommitted(table)).toBe(false);
  });

  it('returns false when table.me has no instanceId', () => {
    const table = {
      me: {},
      action: { useArmorByTargetId: { 'char-1': true }, effects: [] },
    };
    expect(armorUseCommitted(table)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasDamage / hasPhysicalDamage
// ---------------------------------------------------------------------------

describe('hasDamage', () => {
  it('returns true when there is a damage effect targeting me with amount > 0', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(true);
  });

  it('returns false when damage amount is 0', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 0, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(false);
  });

  it('returns false when damage targets someone else', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-2' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(false);
  });

  it('returns true for magic damage', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 3, damageType: 'magic' },
        ],
      },
    };
    expect(hasDamage(table)).toBe(true);
  });

  it('returns false when action is undefined', () => {
    expect(hasDamage({ me: { instanceId: 'char-1' } })).toBe(false);
  });
});

describe('hasPhysicalDamage', () => {
  it('returns true for physical damage targeting me', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'physical' },
        ],
      },
    };
    expect(hasPhysicalDamage(table)).toBe(true);
  });

  it('returns false for magic damage', () => {
    const me = { instanceId: 'char-1' };
    const table = {
      me,
      action: {
        effects: [
          { type: 'damage', target: { instanceId: 'char-1' }, amount: 5, damageType: 'magic' },
        ],
      },
    };
    expect(hasPhysicalDamage(table)).toBe(false);
  });

  it('returns false when action is undefined', () => {
    expect(hasPhysicalDamage({ me: { instanceId: 'char-1' } })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// youDealMinorDamage / youDealMajorDamage / youDealSevereDamage
// ---------------------------------------------------------------------------

function makeDealTable({ actorId, target, effect }) {
  const me = { instanceId: actorId, isActing: true };
  const actor = { instanceId: actorId };
  return {
    me,
    action: {
      actor,
      target,
      targets: target ? [target] : [],
      effects: [effect],
    },
  };
}

describe('youAreTheActor / youDeal* pending HP tiers', () => {
  const adv = { instanceId: 'adv-1', isAdversary: true };

  it('youAreTheActor is true when me matches action.actor', () => {
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: adv, amount: 1 },
    });
    expect(youAreTheActor(t)).toBe(true);
  });

  it('youAreTheActor is false when another actor acts', () => {
    const me = { instanceId: 'char-1', isActing: false };
    const table = {
      me,
      action: {
        actor: { instanceId: 'char-2' },
        target: adv,
        effects: [{ stat: 'currentHP', target: adv, amount: 1 }],
      },
    };
    expect(youAreTheActor(table)).toBe(false);
  });

  it('youDealMinorDamage: amount 1, null tiers', () => {
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: adv, amount: 1 },
    });
    expect(youDealMinorDamage(t)).toBe(true);
    expect(youDealMajorDamage(t)).toBe(false);
    expect(youDealSevereDamage(t)).toBe(false);
  });

  it('youDealMajorDamage: amount 2, null tiers', () => {
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: adv, amount: 2 },
    });
    expect(youDealMinorDamage(t)).toBe(false);
    expect(youDealMajorDamage(t)).toBe(true);
    expect(youDealSevereDamage(t)).toBe(false);
  });

  it('youDealSevereDamage: amount >= 3, null tiers', () => {
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: adv, amount: 3 },
    });
    expect(youDealSevereDamage(t)).toBe(true);
    expect(isSeverePendingHpLossEffect(pendingHpLossToPrimaryTargetEffect(t))).toBe(true);
  });

  it('youDealSevereDamage: amount 2 with damageTier severe (VTT edge case)', () => {
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: adv, amount: 2, damageTier: 'severe' },
    });
    expect(youDealSevereDamage(t)).toBe(true);
    expect(youDealMajorDamage(t)).toBe(false);
  });

  it('isMajorPendingHpLossEffect is false when tier says severe even if amount is 2', () => {
    const e = { stat: 'currentHP', target: adv, amount: 2, damageTier: 'severe' };
    expect(isMajorPendingHpLossEffect(e)).toBe(false);
    expect(isSeverePendingHpLossEffect(e)).toBe(true);
  });

  it('youDeal* is false when HP effect targets a different instance than primary target', () => {
    const other = { instanceId: 'adv-2', isAdversary: true };
    const t = makeDealTable({
      actorId: 'char-1',
      target: adv,
      effect: { stat: 'currentHP', target: other, amount: 3 },
    });
    expect(youDealSevereDamage(t)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// youTakeMinorDamage / youTakeMajorDamage / youTakeSevereDamage (incoming to table.me)
// ---------------------------------------------------------------------------

function makeTakeTable({ meId, effects }) {
  const me = { instanceId: meId };
  return {
    me,
    action: {
      effects,
    },
  };
}

describe('youTake* / effectTargetsMe — pending HP to table.me', () => {
  it('youTakeSevereDamage: severe to me (amount >= 3)', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 3 }],
    });
    expect(youTakeSevereDamage(t)).toBe(true);
    expect(youTakeMajorDamage(t)).toBe(false);
    expect(youTakeMinorDamage(t)).toBe(false);
  });

  it('youTakeSevereDamage: amount 2 with damageTier severe', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2, damageTier: 'severe' }],
    });
    expect(youTakeSevereDamage(t)).toBe(true);
  });

  it('youTakeMajorDamage: amount 2, null tiers', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }],
    });
    expect(youTakeMajorDamage(t)).toBe(true);
  });

  it('youTakeMinorDamage: amount 1', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1 }],
    });
    expect(youTakeMinorDamage(t)).toBe(true);
  });

  it('false when HP targets another instance', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 3 }],
    });
    expect(youTakeSevereDamage(t)).toBe(false);
    expect(effectTargetsMe(t.action.effects[0], t)).toBe(false);
  });

  it('some(): any matching line to me counts as severe', () => {
    const t = makeTakeTable({
      meId: 'char-1',
      effects: [
        { stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 1 },
        { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 3 },
      ],
    });
    expect(youTakeSevereDamage(t)).toBe(true);
  });

  it('effectTargetsMe is true for currentHP on me', () => {
    const me = { instanceId: 'char-1' };
    const e = { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 };
    expect(effectTargetsMe(e, { me })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// unwrap()
// ---------------------------------------------------------------------------

describe('unwrap()', () => {
  it('returns non-wrapped values as-is', () => {
    const table = makeTable();
    expect(unwrap(42, table)).toBe(42);
    expect(unwrap('hello', table)).toBe('hello');
    expect(unwrap(null, table)).toBe(null);
    expect(unwrap(undefined, table)).toBe(undefined);
    const obj = { a: 1 };
    expect(unwrap(obj, table)).toBe(obj);
  });

  it('returns the wrapped value when all predicates pass', () => {
    const table = makeTable(true);
    const w = when(isActing, { foo: 'bar' });
    expect(unwrap(w, table)).toEqual({ foo: 'bar' });
  });

  it('returns undefined when a predicate fails', () => {
    const table = makeTable(false);
    const w = when(isActing, { foo: 'bar' });
    expect(unwrap(w, table)).toBe(undefined);
  });

  it('requires ALL predicates to pass', () => {
    const table = makeTable(true);
    const alwaysFalse = () => false;
    const w = when(isActing, alwaysFalse, 42);
    expect(unwrap(w, table)).toBe(undefined);
  });

  it('returns a function value correctly', () => {
    const fn = (t) => t.me.gainHope?.(1);
    const table = makeTable(true);
    const w = when(isActing, fn);
    expect(unwrap(w, table)).toBe(fn);
  });
});

// ---------------------------------------------------------------------------
// unwrapAll()
// ---------------------------------------------------------------------------

describe('unwrapAll()', () => {
  it('passes through non-wrapped primitives', () => {
    const table = makeTable();
    expect(unwrapAll(42, table)).toBe(42);
    expect(unwrapAll('x', table)).toBe('x');
  });

  it('recursively unwraps object values', () => {
    const table = makeTable(true);
    const obj = {
      always: 'yes',
      conditional: when(isActing, 99),
    };
    const result = unwrapAll(obj, table);
    expect(result.always).toBe('yes');
    expect(result.conditional).toBe(99);
  });

  it('omits object keys whose when() wrapper fails', () => {
    const table = makeTable(false);
    const obj = {
      always: 'yes',
      conditional: when(isActing, 99),
    };
    const result = unwrapAll(obj, table);
    expect(result.always).toBe('yes');
    expect('conditional' in result).toBe(false);
  });

  it('filters array elements whose when() wrapper fails', () => {
    const table = makeTable(false);
    const arr = ['always', when(isActing, 'ifActing'), 'also'];
    const result = unwrapAll(arr, table);
    expect(result).toEqual(['always', 'also']);
  });

  it('keeps array elements whose when() wrapper passes', () => {
    const table = makeTable(true);
    const arr = ['always', when(isActing, 'ifActing'), 'also'];
    const result = unwrapAll(arr, table);
    expect(result).toEqual(['always', 'ifActing', 'also']);
  });

  it('resolves a top-level when() wrapper to undefined when false', () => {
    const table = makeTable(false);
    const w = when(isActing, { big: 'object' });
    expect(unwrapAll(w, table)).toBe(undefined);
  });

  it('resolves a top-level when() wrapper to the value when true', () => {
    const table = makeTable(true);
    const w = when(isActing, { big: 'object' });
    expect(unwrapAll(w, table)).toEqual({ big: 'object' });
  });

  it('recursively resolves nested when() in nested objects', () => {
    const table = makeTable(true);
    const obj = {
      outer: {
        inner: when(isActing, 'deep'),
      },
    };
    const result = unwrapAll(obj, table);
    expect(result.outer.inner).toBe('deep');
  });

  it('preserves functions (does not try to recurse into them)', () => {
    const table = makeTable(true);
    const fn = () => {};
    const obj = { hook: fn };
    const result = unwrapAll(obj, table);
    expect(result.hook).toBe(fn);
  });
});
