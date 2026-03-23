/**
 * V2 `actor.move(conditionFn, desiredCondition, description?, opts?)` — client-side pending map positioning.
 *
 * The engine queues a `move` mutation with a live `conditionFn`. The Game Table stores
 * `conditionFn` in this module's registry (not in Postgres) and syncs a lightweight
 * `v2PendingMove` blob on the mover element for cross-client UI. On **GM token drop** only,
 * we rebuild the same `table` snapshot as review-chip activation and re-run `conditionFn(table)`;
 * `conditionMet` on the element is updated each drop; Ack stays disabled until `conditionMet` is true and re-disables if the position becomes invalid again. `v2PendingMove` clears on banner ack/cancel only.
 */

import { buildV2ReviewChipTableSnapshot } from './v2-action-loop-bridge.js';
import { getPendingMapRehydrateEntry } from './v2-pending-map-rehydrate-registry.js';

/** Must match `freezeReason` / default lock in table `move` mutation (e.g. Faun Kick). */
export const V2_KICK_PENDING_MAP_LOCK = 'Kick: pending map position';

/** @type {Map<string, { rollDbId: number|string, moverInstanceId: string, conditionFn: function, desiredCondition: string, description: string, chipStub: object }>} */
const registry = new Map();

/** Dice roll row ids may be number (DB) or string (JSON); strict === breaks registry + banner matching. */
function rollDbIdsEqual(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function registryKey(rollDbId, moverInstanceId) {
  return `${String(rollDbId)}:${moverInstanceId}`;
}

/**
 * @param {object} params
 * @param {number|string} params.rollDbId
 * @param {string} params.moverInstanceId
 * @param {(table: object) => boolean} params.conditionFn
 * @param {string} params.desiredCondition
 * @param {string} [params.description]
 * @param {{ _featureName: string, _ownerInstanceId: string, _crossSheetViewerInstanceId?: string }} params.chipStub
 */
export function registerV2PendingMapMove({ rollDbId, moverInstanceId, conditionFn, desiredCondition, description, chipStub }) {
  if (rollDbId == null || !moverInstanceId || typeof conditionFn !== 'function') return;
  const dc = String(desiredCondition ?? '').trim();
  const ds = String(description ?? '').trim();
  registry.set(registryKey(rollDbId, moverInstanceId), {
    rollDbId,
    moverInstanceId: String(moverInstanceId),
    conditionFn,
    desiredCondition: dc || ds,
    description: dc ? ds : '',
    chipStub,
  });
}

/**
 * Restores in-memory pending-map registry after full page reload: `conditionFn` cannot be serialized;
 * `v2PendingMove.rehydrateKey` must be persisted (engine `move` mutation) and listed in
 * `v2-pending-map-rehydrate-registry.js`.
 *
 * Does not require `srdData` — registry restore must run on first layout even while SRD is still loading.
 */
export function ensureV2PendingMapRegistry(activeElements, pendingBanners) {
  if (!Array.isArray(activeElements) || !Array.isArray(pendingBanners)) return;
  for (const el of activeElements) {
    const p = el?.v2PendingMove;
    if (!p || p.rollDbId == null) continue;
    const moverId = p.moverInstanceId || el.instanceId;
    if (!moverId) continue;
    if (registry.has(registryKey(p.rollDbId, moverId))) continue;
    const roll = pendingBanners.find((r) => rollDbIdsEqual(r._rollDbId, p.rollDbId));
    if (!roll) continue;
    const rk = p.rehydrateKey != null && String(p.rehydrateKey).trim() !== '' ? String(p.rehydrateKey).trim() : null;
    if (!rk) continue;
    const entry = getPendingMapRehydrateEntry(rk);
    if (!entry || typeof entry.conditionFn !== 'function' || !entry.featureName) continue;
    const ownerId = entry.resolveChipOwner(p, moverId, roll);
    if (!ownerId) continue;
    registerV2PendingMapMove({
      rollDbId: p.rollDbId,
      moverInstanceId: String(moverId),
      conditionFn: entry.conditionFn,
      desiredCondition: p.desiredCondition,
      description: p.description,
      chipStub: {
        _featureName: entry.featureName,
        _ownerInstanceId: ownerId,
      },
    });
  }
}

export function unregisterV2PendingMapMove(rollDbId, moverInstanceId) {
  if (rollDbId == null || !moverInstanceId) return;
  registry.delete(registryKey(rollDbId, moverInstanceId));
}

/** Remove all registry entries tied to a banner roll (cancel / ack / manual). */
export function unregisterV2PendingMapMovesForRoll(rollDbId) {
  if (rollDbId == null) return;
  for (const k of [...registry.keys()]) {
    const v = registry.get(k);
    if (v && rollDbIdsEqual(v.rollDbId, rollDbId)) registry.delete(k);
  }
}

export function listPendingMapMovesForMover(moverInstanceId) {
  if (!moverInstanceId) return [];
  const id = String(moverInstanceId);
  return [...registry.values()].filter((v) => v.moverInstanceId === id);
}

/**
 * @param {object} roll — pending banner roll
 * @param {object[]} elements — characters + adversaries (full table)
 * @returns {{ blocked: boolean, desiredCondition?: string, description?: string, featureName?: string }}
 */
export function getV2PendingMoveBlockInfo(roll, elements) {
  if (!roll?._rollDbId || !Array.isArray(elements)) {
    return { blocked: false, desiredCondition: '', description: '', featureName: '' };
  }
  const id = roll._rollDbId;
  for (const el of elements) {
    const p = el?.v2PendingMove;
    if (p && rollDbIdsEqual(p.rollDbId, id)) {
      const satisfied = p.conditionMet === true;
      const dcField = String(p.desiredCondition ?? '').trim();
      const legacyDesc = String(p.description ?? '').trim();
      const desired = dcField || legacyDesc;
      const extra = dcField ? legacyDesc : '';
      return {
        blocked: !satisfied,
        desiredCondition: desired,
        description: extra,
        featureName: getRegistryFeatureNameForRoll(id, elements),
      };
    }
  }
  return { blocked: false, desiredCondition: '', description: '', featureName: '' };
}

function getRegistryFeatureNameForRoll(rollDbId, elements) {
  for (const v of registry.values()) {
    if (rollDbIdsEqual(v.rollDbId, rollDbId)) {
      const n = v.chipStub?._featureName;
      return typeof n === 'string' ? n.trim() : '';
    }
  }
  if (Array.isArray(elements)) {
    for (const el of elements) {
      const p = el?.v2PendingMove;
      if (p && rollDbIdsEqual(p.rollDbId, rollDbId) && p.rehydrateKey) {
        const entry = getPendingMapRehydrateEntry(p.rehydrateKey);
        const n = entry?.featureName;
        return typeof n === 'string' ? n.trim() : '';
      }
    }
  }
  return '';
}

/**
 * When a server follow-up replaces the pending banner (e.g. `postBannerAddDamage`), migrate
 * registry + `v2PendingMove.rollDbId` so blocking/evaluation still match `roll._rollDbId`.
 *
 * @param {object[]|undefined} [activeElements] — when set, preserves `conditionMet` from the mover row
 * @returns {{ instanceId: string, updates: { v2PendingMove: object } }[]}
 */
export function migrateV2PendingMapRollId(oldRollDbId, newRollDbId, activeElements) {
  if (oldRollDbId == null || newRollDbId == null || rollDbIdsEqual(oldRollDbId, newRollDbId)) return [];
  const out = [];
  for (const [key, entry] of [...registry.entries()]) {
    if (!rollDbIdsEqual(entry.rollDbId, oldRollDbId)) continue;
    registry.delete(key);
    const next = { ...entry, rollDbId: newRollDbId };
    registry.set(registryKey(newRollDbId, entry.moverInstanceId), next);
    const el = Array.isArray(activeElements)
      ? activeElements.find((e) => e.instanceId === entry.moverInstanceId)
      : null;
    const prev = el?.v2PendingMove;
    const conditionMet =
      prev && rollDbIdsEqual(prev.rollDbId, oldRollDbId) && prev.conditionMet === true ? true : false;
    const frozen =
      prev && rollDbIdsEqual(prev.rollDbId, oldRollDbId) && prev.frozenInstanceId && prev.frozenLockSource
        ? { frozenInstanceId: prev.frozenInstanceId, frozenLockSource: prev.frozenLockSource }
        : {};
    const mergedDc =
      String(prev?.desiredCondition ?? '').trim() || String(entry.desiredCondition ?? '').trim();
    const mergedLong =
      String(prev?.description ?? '').trim() || String(entry.description ?? '').trim();
    const primary = mergedDc || mergedLong || 'Map position';
    const supplementary = mergedDc ? mergedLong : '';
    const rk =
      prev && rollDbIdsEqual(prev.rollDbId, oldRollDbId) && prev.rehydrateKey
        ? prev.rehydrateKey
        : undefined;
    out.push({
      instanceId: entry.moverInstanceId,
      updates: {
        v2PendingMove: {
          rollDbId: newRollDbId,
          desiredCondition: primary,
          description: supplementary,
          moverInstanceId: entry.moverInstanceId,
          conditionMet,
          ...frozen,
          ...(rk ? { rehydrateKey: rk } : {}),
        },
      },
    });
    if (frozen.frozenInstanceId) {
      out.push({
        instanceId: frozen.frozenInstanceId,
        updates: { v2MoveLockRollDbId: newRollDbId },
      });
    }
  }
  return out;
}

/**
 * @param {object} entry — registry entry
 * @param {object} roll
 * @param {object[]} activeElements
 * @param {object} srdData
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object }} opts
 */
export function tryEvaluateV2PendingMapMove(entry, roll, activeElements, srdData, opts = {}) {
  const table = buildV2ReviewChipTableSnapshot(entry.chipStub, roll, activeElements, srdData, opts);
  if (!table) return false;
  try {
    return !!entry.conditionFn(table);
  } catch {
    return false;
  }
}

/**
 * After reload or when `srdData` / `pendingBanners` become available, re-run `conditionFn` for every
 * element with `v2PendingMove` so `conditionMet` matches the current map (also used after token drag).
 *
 * @returns {{ instanceId: string, updates: { v2PendingMove: object } }[]}
 */
export function collectV2PendingMapMoveReEvalUpdates(activeElements, pendingBanners, srdData, opts = {}) {
  if (!srdData || !Array.isArray(activeElements) || !Array.isArray(pendingBanners)) return [];
  ensureV2PendingMapRegistry(activeElements, pendingBanners);
  const out = [];
  const seen = new Set();
  for (const el of activeElements) {
    const p = el?.v2PendingMove;
    if (!p?.rollDbId) continue;
    const moverId = p.moverInstanceId || el.instanceId;
    if (!moverId) continue;
    const sk = `${String(p.rollDbId)}:${String(moverId)}`;
    if (seen.has(sk)) continue;
    seen.add(sk);
    const part = evaluateV2PendingMapMovesForMover(moverId, {
      postMoveActiveElements: activeElements,
      pendingBanners,
      srdData,
      fearCount: opts.fearCount,
      mapConfig: opts.mapConfig,
      tableFeatureState: opts.tableFeatureState,
    });
    out.push(...part);
  }
  return out;
}

export function evaluateV2PendingMapMovesForMover(moverInstanceId, {
  postMoveActiveElements,
  pendingBanners,
  srdData,
  fearCount,
  mapConfig,
  tableFeatureState,
}) {
  const out = [];
  const entries = listPendingMapMovesForMover(moverInstanceId);
  if (!entries.length || !Array.isArray(postMoveActiveElements) || !Array.isArray(pendingBanners) || !srdData) {
    return out;
  }
  const opts = { fearCount, mapConfig, tableFeatureState };
  for (const entry of entries) {
    const roll = pendingBanners.find((r) => rollDbIdsEqual(r._rollDbId, entry.rollDbId));
    if (!roll) continue;
    const el = postMoveActiveElements.find((e) => e.instanceId === entry.moverInstanceId);
    if (!el?.v2PendingMove || !rollDbIdsEqual(el.v2PendingMove.rollDbId, entry.rollDbId)) continue;
    const met = tryEvaluateV2PendingMapMove(entry, roll, postMoveActiveElements, srdData, opts);
    if (el.v2PendingMove.conditionMet === met) continue;
    out.push({
      instanceId: entry.moverInstanceId,
      updates: {
        v2PendingMove: {
          ...el.v2PendingMove,
          conditionMet: met,
        },
      },
    });
  }
  return out;
}

/**
 * Build `update-elements` rows to clear `v2PendingMove` for a roll (banner ack/cancel).
 *
 * @param {object} [rollMeta] — optional pending roll; lifts orphan Kick locks on attacker/target
 *   after add-damage roll-id migration.
 * @returns {{ instanceId: string, updates: { v2PendingMove: null } }[]}
 */
export function clearV2PendingMoveElementsForRoll(rollDbId, activeElements, rollMeta) {
  if (rollDbId == null || !Array.isArray(activeElements)) return [];
  unregisterV2PendingMapMovesForRoll(rollDbId);
  const merge = new Map();

  function push(instanceId, partial) {
    if (!instanceId) return;
    const prev = merge.get(instanceId) || {};
    merge.set(instanceId, { ...prev, ...partial });
  }

  const rollKey = String(rollDbId);

  for (const el of activeElements) {
    const p = el?.v2PendingMove;
    if (!p || String(p.rollDbId) !== rollKey) continue;
    push(el.instanceId, { v2PendingMove: null });
    const { frozenInstanceId, frozenLockSource } = p;
    if (frozenInstanceId && frozenLockSource) {
      const frozenEl = activeElements.find((e) => e.instanceId === frozenInstanceId);
      const list = Array.isArray(frozenEl?.moveDisabledSources)
        ? frozenEl.moveDisabledSources.filter((s) => s !== frozenLockSource)
        : [];
      push(frozenInstanceId, {
        moveDisabledSources: list,
        v2MoveLockRollDbId: null,
        v2MoveLockSource: null,
      });
    }
  }

  // Fallback: mover blob missing from snapshot but frozen element still tagged by roll id
  for (const el of activeElements) {
    const rid = el?.v2MoveLockRollDbId;
    if (rid == null || String(rid) !== rollKey) continue;
    const src = el?.v2MoveLockSource;
    const strip = src && String(src).trim() !== '' ? String(src).trim() : V2_KICK_PENDING_MAP_LOCK;
    const list = Array.isArray(el.moveDisabledSources)
      ? el.moveDisabledSources.filter((s) => s !== strip)
      : [];
    push(el.instanceId, {
      moveDisabledSources: list,
      v2MoveLockRollDbId: null,
      v2MoveLockSource: null,
    });
  }

  // Orphan/stale Kick lock after banner id migration (add-damage): mover blob may lack
  // frozenInstanceId; frozen actor may have only moveDisabledSources + mismatched roll id.
  if (rollMeta) {
    const participantIds = new Set();
    if (rollMeta._attackerInstanceId) participantIds.add(String(rollMeta._attackerInstanceId));
    if (rollMeta._selectedTargetInstanceId) participantIds.add(String(rollMeta._selectedTargetInstanceId));
    if (Array.isArray(rollMeta._selectedTargetInstanceIds)) {
      for (const id of rollMeta._selectedTargetInstanceIds) {
        if (id != null && id !== '') participantIds.add(String(id));
      }
    }
    for (const pid of participantIds) {
      const el = activeElements.find((e) => e.instanceId === pid);
      if (!el) continue;
      const list = Array.isArray(el.moveDisabledSources) ? [...el.moveDisabledSources] : [];
      if (!list.includes(V2_KICK_PENDING_MAP_LOCK)) continue;
      const nextList = list.filter((s) => s !== V2_KICK_PENDING_MAP_LOCK);
      push(pid, {
        moveDisabledSources: nextList,
        v2MoveLockRollDbId: null,
        v2MoveLockSource: null,
      });
    }
  }

  const out = [...merge.entries()].map(([instanceId, updates]) => ({ instanceId, updates }));
  return out;
}
