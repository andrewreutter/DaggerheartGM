/**
 * Rehydration data for `v2PendingMove` after reload. `conditionFn` cannot be serialized; the engine
 * must persist `rehydrateKey` on the `move` mutation (see `table.js` actor.move). Each key used in
 * features must be registered here so `ensureV2PendingMapRegistry` can restore evaluation + chip
 * stubs for `buildV2ReviewChipTableSnapshot`.
 *
 * Feature modules own their keys: add a row when introducing `move(..., { rehydrateKey: 'x.y' })`.
 */

/**
 * @typedef {object} PendingMapRehydrateEntry
 * @property {string} featureName — `chipStub._featureName` (must match a loaded V2 feature row name)
 * @property {(table: object) => boolean} conditionFn — same predicate as live `move(conditionFn, ...)`
 * @property {(p: object, moverId: string, roll: object) => string|null|undefined} resolveChipOwner —
 *   returns `chipStub._ownerInstanceId` for the snapshot (usually the attacker / feature owner)
 */

/** @type {Record<string, PendingMapRehydrateEntry>} */
const PENDING_MAP_REHYDRATE_REGISTRY = {
  'faun.kick.push': {
    featureName: 'Kick',
    conditionFn: (t) => t.action?.target?.rangeFrom(t.action?.attacker) === 'veryClose',
    resolveChipOwner(p, moverId, roll) {
      const fromRoll = roll?._attackerInstanceId;
      if (fromRoll) return fromRoll;
      if (p?.frozenInstanceId) return p.frozenInstanceId;
      return null;
    },
  },
  'faun.kick.leap': {
    featureName: 'Kick',
    conditionFn: (t) => t.me?.rangeFrom(t.action?.target) === 'veryClose',
    resolveChipOwner(p, moverId, roll) {
      const fromRoll = roll?._attackerInstanceId;
      if (fromRoll) return fromRoll;
      if (moverId) return moverId;
      return null;
    },
  },
};

/**
 * @param {string|null|undefined} rehydrateKey
 * @returns {PendingMapRehydrateEntry|null}
 */
export function getPendingMapRehydrateEntry(rehydrateKey) {
  if (rehydrateKey == null || String(rehydrateKey).trim() === '') return null;
  return PENDING_MAP_REHYDRATE_REGISTRY[String(rehydrateKey).trim()] ?? null;
}
