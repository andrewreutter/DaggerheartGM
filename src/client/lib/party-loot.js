import { normalizeInventoryList } from './character-inventory.js';

/** @typedef {{ scope: 'party' } | { scope: 'character', instanceId: string }} InventoryMoveScope */

export function normalizePartyLoot(raw) {
  const gold = Math.max(0, Math.floor(Number(raw?.gold) || 0));
  return {
    gold,
    inventory: normalizeInventoryList(raw?.inventory),
  };
}

export function inventoryScopeLabel(scope, characters = []) {
  if (!scope || typeof scope !== 'object') return '';
  if (scope.scope === 'party') return 'Party Loot';
  const row = characters.find((c) => c && c.instanceId === scope.instanceId);
  const name = typeof row?.name === 'string' ? row.name.trim() : '';
  return name || 'Unnamed';
}

function scopesEqual(a, b) {
  if (!a || !b || a.scope !== b.scope) return false;
  if (a.scope === 'party') return true;
  return a.instanceId === b.instanceId;
}

/**
 * Destinations for an inventory move menu: Party Loot plus each character,
 * excluding the inventory currently being viewed.
 *
 * @param {{ current?: InventoryMoveScope, characters?: { instanceId: string, name?: string }[] }} args
 * @returns {(InventoryMoveScope & { label: string })[]}
 */
export function listInventoryMoveDestinations({ current, characters = [] } = {}) {
  const dests = [];
  if (!current || current.scope !== 'party') {
    dests.push({ scope: 'party', label: 'Party Loot' });
  }
  for (const c of characters) {
    if (!c?.instanceId) continue;
    if (current?.scope === 'character' && c.instanceId === current.instanceId) continue;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    dests.push({
      scope: 'character',
      instanceId: c.instanceId,
      label: name || 'Unnamed',
    });
  }
  return dests;
}

function readScopeInventory(state, scope) {
  if (!scope || typeof scope !== 'object') return null;
  if (scope.scope === 'party') {
    return normalizePartyLoot(state.partyLoot).inventory;
  }
  if (scope.scope !== 'character' || !scope.instanceId) return null;
  const elements = Array.isArray(state.activeElements) ? state.activeElements : [];
  const el = elements.find((e) => e?.elementType === 'character' && e.instanceId === scope.instanceId);
  if (!el) return null;
  return normalizeInventoryList(el.inventory);
}

/**
 * Atomic inventory-row move. Returns a table-op patch (`partyLoot` and/or `activeElements`)
 * or `{}` when the uid / destination is missing or the scopes match.
 *
 * @param {{ partyLoot?: object, activeElements?: object[] }} state
 * @param {{ from?: InventoryMoveScope, to?: InventoryMoveScope, uid?: string }} move
 */
export function applyInventoryMove(state, { from, to, uid } = {}) {
  if (!uid || typeof uid !== 'string' || !from || !to || scopesEqual(from, to)) return {};
  const fromInv = readScopeInventory(state, from);
  const toInv = readScopeInventory(state, to);
  if (!fromInv || !toInv) return {};
  const item = fromInv.find((e) => e.uid === uid);
  if (!item) return {};

  const nextFrom = fromInv.filter((e) => e.uid !== uid);
  const nextTo = toInv.some((e) => e.uid === uid) ? toInv : [...toInv, item];

  const out = {};
  let partyLoot = normalizePartyLoot(state.partyLoot);
  let activeElements = Array.isArray(state.activeElements) ? state.activeElements : [];
  let touchedParty = false;
  let touchedEls = false;

  if (from.scope === 'party') {
    partyLoot = { ...partyLoot, inventory: nextFrom };
    touchedParty = true;
  } else {
    activeElements = activeElements.map((el) => (
      el.instanceId === from.instanceId ? { ...el, inventory: nextFrom } : el
    ));
    touchedEls = true;
  }

  if (to.scope === 'party') {
    partyLoot = { ...partyLoot, inventory: nextTo };
    touchedParty = true;
  } else {
    activeElements = activeElements.map((el) => (
      el.instanceId === to.instanceId ? { ...el, inventory: nextTo } : el
    ));
    touchedEls = true;
  }

  if (touchedParty) out.partyLoot = partyLoot;
  if (touchedEls) out.activeElements = activeElements;
  return out;
}

export function buildPartyLootActionNotification(before, patch) {
  const titles = [];
  const bodies = [];
  if (patch && patch.gold !== undefined) {
    const prev = before?.gold ?? 0;
    const after = patch.gold;
    const delta = after - prev;
    if (delta > 0) titles.push(`Gained ${delta} gold`);
    else if (delta < 0) titles.push(`Spent ${-delta} gold`);
    else titles.push('Gold');
    bodies.push(`Gold changed from ${prev} to ${after}`);
  }
  if (patch && patch.inventory !== undefined) {
    const after = Array.isArray(patch.inventory) ? patch.inventory.length : 0;
    titles.push('Inventory');
    bodies.push(`Inventory updated (${after} item${after !== 1 ? 's' : ''})`);
  }
  return {
    _action: true,
    rollUser: 'Party Loot',
    actionName: titles.length ? titles.join(' · ') : 'Party Loot',
    actionText: bodies.length ? bodies.join('\n') : 'Party loot updated.',
  };
}

export function buildInventoryMoveActionNotification({ itemName, fromLabel, toLabel } = {}) {
  const name = itemName || 'item';
  const src = fromLabel || 'inventory';
  const dst = toLabel || 'inventory';
  return {
    _action: true,
    rollUser: src,
    actionName: `Moved ${name}`,
    actionText: `Moved ${name} from ${src} to ${dst}`,
  };
}
