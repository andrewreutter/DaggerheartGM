import { describe, it, expect } from 'vitest';
import {
  normalizePartyLoot,
  listInventoryMoveDestinations,
  applyInventoryMove,
  inventoryScopeLabel,
} from '../../src/client/lib/party-loot.js';

describe('normalizePartyLoot', () => {
  it('defaults empty bags to gold 0 and [] inventory', () => {
    expect(normalizePartyLoot(null)).toEqual({ gold: 0, inventory: [] });
    expect(normalizePartyLoot(undefined)).toEqual({ gold: 0, inventory: [] });
  });

  it('floors gold and normalizes inventory rows', () => {
    const out = normalizePartyLoot({
      gold: 12.9,
      inventory: [{ uid: 'r1', name: 'Rope', quantity: 2 }],
    });
    expect(out.gold).toBe(12);
    expect(out.inventory).toEqual([{ uid: 'r1', name: 'Rope', quantity: 2 }]);
  });
});

describe('listInventoryMoveDestinations', () => {
  const chars = [
    { instanceId: 'c1', name: 'Ava' },
    { instanceId: 'c2', name: 'Ben' },
  ];

  it('from party excludes Party Loot and lists every character', () => {
    expect(listInventoryMoveDestinations({ current: { scope: 'party' }, characters: chars })).toEqual([
      { scope: 'character', instanceId: 'c1', label: 'Ava' },
      { scope: 'character', instanceId: 'c2', label: 'Ben' },
    ]);
  });

  it('from a character excludes that character and includes Party Loot', () => {
    expect(listInventoryMoveDestinations({
      current: { scope: 'character', instanceId: 'c1' },
      characters: chars,
    })).toEqual([
      { scope: 'party', label: 'Party Loot' },
      { scope: 'character', instanceId: 'c2', label: 'Ben' },
    ]);
  });

  it('uses Unnamed when a character has no name', () => {
    const dests = listInventoryMoveDestinations({
      current: { scope: 'party' },
      characters: [{ instanceId: 'c9' }],
    });
    expect(dests[0].label).toBe('Unnamed');
  });
});

describe('applyInventoryMove', () => {
  const item = { uid: 'u1', name: 'Torch', quantity: 2, id: 'srd-itm-torch', refCollection: 'items' };
  const hero = {
    instanceId: 'c1',
    elementType: 'character',
    name: 'Ava',
    inventory: [item],
  };
  const ally = {
    instanceId: 'c2',
    elementType: 'character',
    name: 'Ben',
    inventory: [],
  };

  it('moves a row from a character to party loot (same uid)', () => {
    const patch = applyInventoryMove(
      { activeElements: [hero, ally], partyLoot: { gold: 3, inventory: [] } },
      { from: { scope: 'character', instanceId: 'c1' }, to: { scope: 'party' }, uid: 'u1' },
    );
    expect(patch.partyLoot.gold).toBe(3);
    expect(patch.partyLoot.inventory).toEqual([item]);
    expect(patch.activeElements.find((e) => e.instanceId === 'c1').inventory).toEqual([]);
    expect(patch.activeElements.find((e) => e.instanceId === 'c2').inventory).toEqual([]);
  });

  it('moves a row from party loot to a character', () => {
    const patch = applyInventoryMove(
      {
        activeElements: [{ ...hero, inventory: [] }, ally],
        partyLoot: { gold: 0, inventory: [item] },
      },
      { from: { scope: 'party' }, to: { scope: 'character', instanceId: 'c2' }, uid: 'u1' },
    );
    expect(patch.partyLoot.inventory).toEqual([]);
    expect(patch.activeElements.find((e) => e.instanceId === 'c2').inventory).toEqual([item]);
  });

  it('moves a row between characters', () => {
    const patch = applyInventoryMove(
      { activeElements: [hero, ally], partyLoot: { gold: 0, inventory: [] } },
      {
        from: { scope: 'character', instanceId: 'c1' },
        to: { scope: 'character', instanceId: 'c2' },
        uid: 'u1',
      },
    );
    expect(patch.partyLoot).toBeUndefined();
    expect(patch.activeElements.find((e) => e.instanceId === 'c1').inventory).toEqual([]);
    expect(patch.activeElements.find((e) => e.instanceId === 'c2').inventory).toEqual([item]);
  });

  it('no-ops when uid is missing', () => {
    const state = { activeElements: [hero], partyLoot: { gold: 0, inventory: [] } };
    expect(applyInventoryMove(state, {
      from: { scope: 'character', instanceId: 'c1' },
      to: { scope: 'party' },
      uid: 'nope',
    })).toEqual({});
  });

  it('no-ops when destination character is missing (source unchanged)', () => {
    const state = { activeElements: [hero], partyLoot: { gold: 0, inventory: [] } };
    expect(applyInventoryMove(state, {
      from: { scope: 'character', instanceId: 'c1' },
      to: { scope: 'character', instanceId: 'missing' },
      uid: 'u1',
    })).toEqual({});
  });

  it('no-ops when from and to are the same scope', () => {
    expect(applyInventoryMove(
      { activeElements: [hero], partyLoot: { gold: 0, inventory: [item] } },
      { from: { scope: 'party' }, to: { scope: 'party' }, uid: 'u1' },
    )).toEqual({});
  });
});

describe('inventoryScopeLabel', () => {
  it('labels party and character scopes', () => {
    expect(inventoryScopeLabel({ scope: 'party' })).toBe('Party Loot');
    expect(inventoryScopeLabel({ scope: 'character', instanceId: 'c1' }, [
      { instanceId: 'c1', name: 'Ava' },
    ])).toBe('Ava');
  });
});
