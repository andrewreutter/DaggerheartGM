import { describe, it, expect } from 'vitest';
import {
  characterCountFromElements,
  isAdversaryPresentForParty,
  filterAdversariesPresentForParty,
  minionGroupSize,
  groupMinionInstances,
  buildMinionGroupElements,
  buildAlwaysPresentClone,
  planMinionGroupReconcile,
  setGroupMinPartySize,
  partitionPresentReserved,
  formatReservedPartyScaleHint,
  planTypeHeaderAdd,
  planTypeHeaderRemove,
  stripPartyScaleFields,
  formatPartyScaleNameSuffix,
  partyScaleOptions,
  buildLibraryAdversaryElements,
} from '../../src/client/lib/party-scaled-adversaries.js';

function char(id) {
  return { instanceId: id, elementType: 'character', name: id };
}

function adv(overrides = {}) {
  return {
    instanceId: overrides.instanceId || 'a1',
    elementType: 'adversary',
    id: 'srd-adv-reaper',
    name: 'Grim Reaper',
    role: overrides.role || 'solo',
    hp_max: 8,
    currentHp: overrides.currentHp ?? 8,
    tokenX: overrides.tokenX ?? null,
    tokenY: overrides.tokenY ?? null,
    ...overrides,
  };
}

describe('characterCountFromElements', () => {
  it('counts character rows and allows 0', () => {
    expect(characterCountFromElements([])).toBe(0);
    expect(characterCountFromElements([adv(), char('c1'), char('c2')])).toBe(2);
  });
});

describe('isAdversaryPresentForParty', () => {
  it('Always vs 5+ at 4 and 5 characters; 0 characters hides 2+ but shows Always', () => {
    const always = adv();
    const atFive = adv({ minPartySize: 5 });
    const atTwo = adv({ minPartySize: 2 });
    expect(isAdversaryPresentForParty(always, 0)).toBe(true);
    expect(isAdversaryPresentForParty(always, 4)).toBe(true);
    expect(isAdversaryPresentForParty(atFive, 4)).toBe(false);
    expect(isAdversaryPresentForParty(atFive, 5)).toBe(true);
    expect(isAdversaryPresentForParty(atTwo, 0)).toBe(false);
    expect(isAdversaryPresentForParty(atTwo, 2)).toBe(true);
    expect(isAdversaryPresentForParty(adv({ minPartySize: 1 }), 0)).toBe(true);
  });
});

describe('filterAdversariesPresentForParty', () => {
  it('keeps non-adversaries and Always rows; drops reserved when count is set', () => {
    const els = [char('c1'), adv({ instanceId: 'a' }), adv({ instanceId: 'b', minPartySize: 5 })];
    expect(filterAdversariesPresentForParty(els, 4).map((e) => e.instanceId)).toEqual(['c1', 'a']);
    expect(filterAdversariesPresentForParty(els, null)).toHaveLength(3);
  });
});

describe('minionGroupSize', () => {
  it('is max(1, characterCount)', () => {
    expect(minionGroupSize(0)).toBe(1);
    expect(minionGroupSize(4)).toBe(4);
    expect(minionGroupSize(5)).toBe(5);
  });
});

describe('buildMinionGroupElements', () => {
  it('Minion + builds N instances with one minionGroupId', () => {
    const els = buildMinionGroupElements(adv({ role: 'minion', name: 'Rat', hp_max: 1 }), { count: 4 });
    expect(els).toHaveLength(4);
    const gid = els[0].minionGroupId;
    expect(gid).toBeTruthy();
    for (const el of els) {
      expect(el.minionGroupId).toBe(gid);
      expect(el.instanceId).toBeTruthy();
      expect(el.tokenX).toBeNull();
      expect(el.currentHp).toBe(1);
      expect(el.minPartySize).toBeUndefined();
    }
    expect(new Set(els.map((e) => e.instanceId)).size).toBe(4);
  });
});

describe('planMinionGroupReconcile', () => {
  it('Reconcile 4→5 adds one per group; 5→4 removes tray member first', () => {
    const gid = 'g-rats';
    const at4 = [
      adv({ instanceId: 'm1', role: 'minion', minionGroupId: gid, tokenX: 10, tokenY: 10, currentHp: 1 }),
      adv({ instanceId: 'm2', role: 'minion', minionGroupId: gid, tokenX: null, tokenY: null, currentHp: 1 }),
      adv({ instanceId: 'm3', role: 'minion', minionGroupId: gid, tokenX: 20, tokenY: 20, currentHp: 1 }),
      adv({ instanceId: 'm4', role: 'minion', minionGroupId: gid, tokenX: null, tokenY: null, currentHp: 1 }),
    ];
    const up = planMinionGroupReconcile(at4, 5);
    expect(up.removeInstanceIds).toEqual([]);
    expect(up.add).toHaveLength(1);
    expect(up.add[0].minionGroupId).toBe(gid);
    expect(up.add[0].tokenX).toBeNull();
    expect(up.add[0].currentHp).toBe(8);

    const at5 = [...at4, up.add[0]];
    const down = planMinionGroupReconcile(at5, 4);
    expect(down.add).toEqual([]);
    expect(down.removeInstanceIds).toHaveLength(1);
    expect(down.removeInstanceIds[0]).toBe(up.add[0].instanceId);
  });

  it('Hidden groups still reconcile so they are the right size when they appear', () => {
    const gid = 'g-hidden';
    const hidden = [
      adv({ instanceId: 'h1', role: 'minion', minionGroupId: gid, minPartySize: 5 }),
      adv({ instanceId: 'h2', role: 'minion', minionGroupId: gid, minPartySize: 5 }),
    ];
    const plan = planMinionGroupReconcile(hidden, 4);
    expect(plan.add).toHaveLength(2);
    expect(plan.add.every((e) => e.minionGroupId === gid && e.minPartySize === 5)).toBe(true);
  });

  it('No-op when already matched', () => {
    const gid = 'g-ok';
    const els = [1, 2, 3, 4].map((i) => adv({ instanceId: `m${i}`, role: 'minion', minionGroupId: gid }));
    expect(planMinionGroupReconcile(els, 4)).toEqual({ add: [], removeInstanceIds: [] });
  });

  it('Legacy minions without minionGroupId are not resized', () => {
    const els = [
      adv({ instanceId: 'l1', role: 'minion' }),
      adv({ instanceId: 'l2', role: 'minion' }),
    ];
    expect(planMinionGroupReconcile(els, 5)).toEqual({ add: [], removeInstanceIds: [] });
  });
});

describe('groupMinionInstances / setGroupMinPartySize', () => {
  it('groups by id and treats ungrouped as solo', () => {
    const a = adv({ instanceId: 'a', minionGroupId: 'g1' });
    const b = adv({ instanceId: 'b', minionGroupId: 'g1' });
    const c = adv({ instanceId: 'c' });
    const groups = groupMinionInstances([a, c, b]);
    expect(groups).toHaveLength(2);
    expect(groups[0].instances.map((e) => e.instanceId)).toEqual(['a', 'b']);
    expect(groups[1].minionGroupId).toBeNull();
    expect(groups[1].instances).toEqual([c]);
  });

  it('sets the same tag on every member; Always clears the field', () => {
    const tagged = setGroupMinPartySize([adv({ instanceId: 'a' }), adv({ instanceId: 'b' })], 5);
    expect(tagged.every((e) => e.minPartySize === 5)).toBe(true);
    const cleared = setGroupMinPartySize(tagged, 1);
    expect(cleared.every((e) => e.minPartySize === undefined)).toBe(true);
  });
});

describe('partition / hints / header plans', () => {
  it('splits present vs reserved and formats the fold hint', () => {
    const instances = [adv({ instanceId: 'a' }), adv({ instanceId: 'b', minPartySize: 5 })];
    const { present, reserved } = partitionPresentReserved(instances, 4);
    expect(present.map((e) => e.instanceId)).toEqual(['a']);
    expect(reserved.map((e) => e.instanceId)).toEqual(['b']);
    expect(formatReservedPartyScaleHint(reserved)).toBe('+1 at 5+ PCs');
    expect(partitionPresentReserved(instances, null).present).toHaveLength(2);
  });

  it('header + Always clone strips scale fields; minion + builds a group', () => {
    const clone = planTypeHeaderAdd(adv({ minPartySize: 5, minionGroupId: 'old' }), {
      isMinion: false,
      characterCount: 4,
    });
    expect(clone).toHaveLength(1);
    expect(clone[0].minPartySize).toBeUndefined();
    expect(clone[0].minionGroupId).toBeUndefined();

    const group = planTypeHeaderAdd(adv({ role: 'minion' }), { isMinion: true, characterCount: 4 });
    expect(group).toHaveLength(4);
    expect(new Set(group.map((e) => e.minionGroupId)).size).toBe(1);
  });

  it('first picker add of a minion is one group of characterCount', () => {
    const els = buildLibraryAdversaryElements(adv({ role: 'minion', minPartySize: 5 }), { characterCount: 4 });
    expect(els).toHaveLength(4);
    expect(new Set(els.map((e) => e.minionGroupId)).size).toBe(1);
    expect(els.every((e) => e.minionGroupId && e.minPartySize == null)).toBe(true);
    expect(buildLibraryAdversaryElements(adv({ role: 'solo' }), { characterCount: 4 })).toHaveLength(1);
  });

  it('copies repeats Always instances or minion groups', () => {
    const solos = buildLibraryAdversaryElements(adv({ role: 'solo' }), { copies: 3 });
    expect(solos).toHaveLength(3);
    expect(new Set(solos.map((e) => e.instanceId)).size).toBe(3);

    const minions = buildLibraryAdversaryElements(adv({ role: 'minion' }), { characterCount: 4, copies: 2 });
    expect(minions).toHaveLength(8);
    expect(new Set(minions.map((e) => e.minionGroupId)).size).toBe(2);
  });

  it('header − removes last instance or the last minion group', () => {
    expect(planTypeHeaderRemove([adv({ instanceId: 'a' }), adv({ instanceId: 'b' })], { isMinion: false }))
      .toEqual(['b']);
    const grouped = [
      adv({ instanceId: 'm1', minionGroupId: 'g1' }),
      adv({ instanceId: 'm2', minionGroupId: 'g1' }),
      adv({ instanceId: 'solo' }),
    ];
    expect(planTypeHeaderRemove(grouped, { isMinion: true })).toEqual(['solo']);
    expect(planTypeHeaderRemove(grouped.slice(0, 2), { isMinion: true })).toEqual(['m1', 'm2']);
  });
});

describe('stripPartyScaleFields / name suffix', () => {
  it('strips scale fields and formats a capture label', () => {
    expect(stripPartyScaleFields({ name: 'X', minPartySize: 5, minionGroupId: 'g' })).toEqual({ name: 'X' });
    expect(formatPartyScaleNameSuffix(adv({ minPartySize: 5 }))).toBe(' (5+ players)');
    expect(partyScaleOptions().find((o) => o.value === 5)?.label).toBe('5+ players');
    expect(formatPartyScaleNameSuffix(adv())).toBe('');
  });
});

describe('buildAlwaysPresentClone', () => {
  it('resets combat/placement and drops scale fields', () => {
    const el = buildAlwaysPresentClone(adv({
      minPartySize: 5,
      minionGroupId: 'g',
      tokenX: 3,
      currentHp: 1,
      conditions: 'dazed',
    }));
    expect(el.minPartySize).toBeUndefined();
    expect(el.minionGroupId).toBeUndefined();
    expect(el.tokenX).toBeNull();
    expect(el.currentHp).toBe(8);
    expect(el.conditions).toBe('');
    expect(el.instanceId).not.toBe('a1');
  });
});
