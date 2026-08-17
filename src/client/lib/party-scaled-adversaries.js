/**
 * Party-scaled adversaries: reserved instances (`minPartySize`) and minion groups
 * (`minionGroupId`) that grow/shrink with the live character count.
 */

import { generateId } from './generate-id.js';

export const PARTY_SCALE_MAX = 8;

/**
 * Raw `elementType === 'character'` count. 0 is allowed (unlike BP `partySize`).
 * @param {Array<{ elementType?: string }>|null|undefined} elements
 * @returns {number}
 */
export function characterCountFromElements(elements) {
  let n = 0;
  for (const el of elements || []) {
    if (el?.elementType === 'character') n += 1;
  }
  return n;
}

/**
 * @param {unknown} value
 * @returns {number} 1 (always) through {@link PARTY_SCALE_MAX}
 */
export function normalizeMinPartySize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 1) return 1;
  return Math.min(PARTY_SCALE_MAX, Math.floor(n));
}

/**
 * Present when `minPartySize` is missing / ≤ 1, or ≤ `characterCount`.
 * @param {{ minPartySize?: number }|null|undefined} el
 * @param {number} characterCount
 * @returns {boolean}
 */
export function isAdversaryPresentForParty(el, characterCount) {
  const min = normalizeMinPartySize(el?.minPartySize);
  if (min <= 1) return true;
  return min <= characterCount;
}

/**
 * @param {Array<object>|null|undefined} elements
 * @param {number|null|undefined} characterCount — `null`/`undefined` keeps every row
 * @returns {object[]}
 */
export function filterAdversariesPresentForParty(elements, characterCount) {
  if (characterCount == null) return elements || [];
  return (elements || []).filter(
    (el) => el?.elementType !== 'adversary' || isAdversaryPresentForParty(el, characterCount),
  );
}

/**
 * One minion group is `max(1, characterCount)` tokens.
 * @param {number} characterCount
 * @returns {number}
 */
export function minionGroupSize(characterCount) {
  const n = Number(characterCount);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Group by `minionGroupId`. Legacy minions without an id are each a solo group.
 * @param {Array<object>|null|undefined} instances
 * @returns {Array<{ minionGroupId: string|null, instances: object[] }>}
 */
export function groupMinionInstances(instances) {
  const groups = [];
  const byId = new Map();
  for (const inst of instances || []) {
    const gid = inst?.minionGroupId;
    if (gid == null || gid === '') {
      groups.push({ minionGroupId: null, instances: [inst] });
      continue;
    }
    let group = byId.get(gid);
    if (!group) {
      group = { minionGroupId: gid, instances: [] };
      byId.set(gid, group);
      groups.push(group);
    }
    group.instances.push(inst);
  }
  return groups;
}

function cloneAdversaryTemplate(template) {
  const {
    instanceId: _instanceId,
    currentHp: _currentHp,
    currentStress: _currentStress,
    conditions: _conditions,
    tokenX: _tokenX,
    tokenY: _tokenY,
    mapId: _mapId,
    altitude: _altitude,
    vulnerable: _vulnerable,
    focusedBy: _focusedBy,
    difficultyMod: _difficultyMod,
    minionGroupParkedPlacements: _parked,
    ...rest
  } = template || {};
  return { ...rest };
}

/**
 * Drop party-scale fields so header **+** / first picker add stays Always.
 * @param {object} data
 * @returns {object}
 */
export function stripPartyScaleFields(data) {
  if (!data || typeof data !== 'object') return data;
  const { minPartySize: _min, minionGroupId: _gid, ...rest } = data;
  return rest;
}

/**
 * N fresh tray instances sharing one `minionGroupId`, full HP.
 * @param {object} template
 * @param {{ groupId?: string, minPartySize?: number, count: number }} opts
 * @returns {object[]}
 */
export function buildMinionGroupElements(template, { groupId, minPartySize, count } = {}) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const id = groupId || generateId();
  const min = normalizeMinPartySize(minPartySize ?? template?.minPartySize);
  const base = stripPartyScaleFields(cloneAdversaryTemplate(template));
  const elements = [];
  for (let i = 0; i < n; i += 1) {
    const el = {
      ...base,
      instanceId: generateId(),
      elementType: 'adversary',
      currentHp: template?.hp_max || 0,
      currentStress: 0,
      conditions: '',
      tokenX: null,
      tokenY: null,
      mapId: null,
      altitude: 0,
      minionGroupId: id,
    };
    if (min > 1) el.minPartySize = min;
    elements.push(el);
  }
  return elements;
}

/**
 * One Always-present clone (no `minPartySize` / `minionGroupId`), tray, full HP.
 * @param {object} template
 * @returns {object}
 */
export function buildAlwaysPresentClone(template) {
  const base = stripPartyScaleFields(cloneAdversaryTemplate(template));
  return {
    ...base,
    instanceId: generateId(),
    elementType: 'adversary',
    currentHp: template?.hp_max || 0,
    currentStress: 0,
    conditions: '',
    tokenX: null,
    tokenY: null,
    mapId: null,
    altitude: 0,
  };
}

/**
 * @param {{ role?: string }|null|undefined} el
 * @returns {boolean}
 */
export function isMinionRole(el) {
  return String(el?.role || '').toLowerCase() === 'minion';
}

/**
 * First picker / library add: Always-present. Minions become one group of
 * {@link minionGroupSize}; other roles are a single instance.
 * `copies` repeats that unit (N instances, or N minion groups).
 * @param {object} item
 * @param {{ characterCount?: number, copies?: number }} [opts]
 * @returns {object[]}
 */
export function buildLibraryAdversaryElements(item, { characterCount, copies = 1 } = {}) {
  const n = Math.max(1, Math.floor(Number(copies) || 1));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    if (isMinionRole(item)) {
      out.push(...buildMinionGroupElements(stripPartyScaleFields(item), {
        count: minionGroupSize(characterCount),
      }));
    } else {
      out.push(buildAlwaysPresentClone(item));
    }
  }
  return out;
}

function isUnplaced(el) {
  return el?.tokenX == null || el?.tokenY == null;
}

function placementOf(el) {
  if (isUnplaced(el)) return null;
  return {
    tokenX: el.tokenX,
    tokenY: el.tokenY,
    mapId: el.mapId ?? null,
    altitude: el.altitude ?? 0,
  };
}

function clonePlacements(list) {
  if (!Array.isArray(list) || !list.length) return [];
  return list.map((p) => ({
    tokenX: p.tokenX,
    tokenY: p.tokenY,
    mapId: p.mapId ?? null,
    altitude: p.altitude ?? 0,
  }));
}

function readGroupStash(instances) {
  for (const el of instances || []) {
    const cloned = clonePlacements(el?.minionGroupParkedPlacements);
    if (cloned.length) return cloned;
  }
  return [];
}

function applyPlacement(el, placement) {
  if (!el || !placement) return el;
  el.tokenX = placement.tokenX;
  el.tokenY = placement.tokenY;
  el.mapId = placement.mapId ?? null;
  el.altitude = placement.altitude ?? 0;
  return el;
}

function placementsEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const x = left[i];
    const y = right[i];
    if (
      x?.tokenX !== y?.tokenX
      || x?.tokenY !== y?.tokenY
      || (x?.mapId ?? null) !== (y?.mapId ?? null)
      || (x?.altitude ?? 0) !== (y?.altitude ?? 0)
    ) return false;
  }
  return true;
}

/**
 * Prefer tray copies, then the last member in encounter order.
 * @param {object[]} instances
 * @param {number} n
 * @returns {string[]}
 */
function pickRemoveInstanceIds(instances, n) {
  if (n <= 0) return [];
  const unplaced = [];
  const placed = [];
  for (const el of instances) {
    if (isUnplaced(el)) unplaced.push(el);
    else placed.push(el);
  }
  const ordered = [...unplaced].reverse().concat([...placed].reverse());
  return ordered.slice(0, n).map((el) => el.instanceId);
}

/**
 * For each `minionGroupId` group (including hidden), diff stored count vs
 * {@link minionGroupSize}. Legacy ungrouped minions are left alone.
 *
 * Tray copies are removed first. A placed token that must come off is deleted,
 * but its map spot is stashed on remaining members as
 * `minionGroupParkedPlacements` and written back onto the next grow.
 *
 * @param {Array<object>|null|undefined} elements
 * @param {number} characterCount
 * @returns {{
 *   add: object[],
 *   removeInstanceIds: string[],
 *   stashUpdates: Array<{ instanceId: string, minionGroupParkedPlacements: object[]|null }>,
 * }}
 */
export function planMinionGroupReconcile(elements, characterCount) {
  const add = [];
  const removeInstanceIds = [];
  const stashUpdates = [];
  const target = minionGroupSize(characterCount);
  const grouped = new Map();
  for (const el of elements || []) {
    if (el?.elementType !== 'adversary' || el.minionGroupId == null || el.minionGroupId === '') continue;
    let list = grouped.get(el.minionGroupId);
    if (!list) {
      list = [];
      grouped.set(el.minionGroupId, list);
    }
    list.push(el);
  }
  for (const [groupId, instances] of grouped) {
    const diff = target - instances.length;
    const stash = readGroupStash(instances);
    const removeSet = new Set();
    if (diff > 0) {
      const fresh = buildMinionGroupElements(instances[0], {
        groupId,
        minPartySize: instances[0].minPartySize,
        count: diff,
      });
      for (const el of fresh) {
        const placement = stash.pop();
        if (placement) applyPlacement(el, placement);
      }
      add.push(...fresh);
    } else if (diff < 0) {
      const toRemove = pickRemoveInstanceIds(instances, -diff);
      for (const id of toRemove) {
        removeSet.add(id);
        const el = instances.find((inst) => inst.instanceId === id);
        const placement = placementOf(el);
        if (placement) stash.push(placement);
        removeInstanceIds.push(id);
      }
    }
    const nextStash = stash.length ? stash : null;
    for (const el of instances) {
      if (removeSet.has(el.instanceId)) continue;
      if (placementsEqual(el.minionGroupParkedPlacements, nextStash)) continue;
      stashUpdates.push({
        instanceId: el.instanceId,
        minionGroupParkedPlacements: nextStash,
      });
    }
  }
  return { add, removeInstanceIds, stashUpdates };
}

/**
 * Apply a {@link planMinionGroupReconcile} plan to an element list.
 * @param {Array<object>|null|undefined} elements
 * @param {{ add?: object[], removeInstanceIds?: string[], stashUpdates?: Array<{ instanceId: string, minionGroupParkedPlacements: object[]|null }> }} plan
 * @returns {object[]}
 */
export function applyMinionGroupReconcilePlan(elements, plan) {
  const removeSet = new Set(plan?.removeInstanceIds || []);
  const stashById = new Map(
    (plan?.stashUpdates || []).map((row) => [row.instanceId, row.minionGroupParkedPlacements]),
  );
  let next = (elements || []).filter((el) => !removeSet.has(el.instanceId)).map((el) => {
    if (!stashById.has(el.instanceId)) return el;
    const copy = { ...el };
    const placements = stashById.get(el.instanceId);
    if (!placements?.length) delete copy.minionGroupParkedPlacements;
    else copy.minionGroupParkedPlacements = clonePlacements(placements);
    return copy;
  });
  if (plan?.add?.length) next = [...next, ...plan.add];
  return next;
}

/**
 * Same `minPartySize` on every member. `n <= 1` clears the field (Always).
 * @param {Array<object>|null|undefined} instances
 * @param {number} n
 * @returns {object[]}
 */
export function setGroupMinPartySize(instances, n) {
  const min = normalizeMinPartySize(n);
  return (instances || []).map((el) => {
    const next = { ...el };
    if (min > 1) next.minPartySize = min;
    else delete next.minPartySize;
    return next;
  });
}

/**
 * @param {Array<object>|null|undefined} instances
 * @param {number|null|undefined} characterCount — `null` = all present (scene editor)
 * @returns {{ present: object[], reserved: object[] }}
 */
export function partitionPresentReserved(instances, characterCount) {
  const present = [];
  const reserved = [];
  for (const inst of instances || []) {
    if (characterCount == null || isAdversaryPresentForParty(inst, characterCount)) present.push(inst);
    else reserved.push(inst);
  }
  return { present, reserved };
}

/**
 * @param {Array<object>|null|undefined} reservedInstances
 * @returns {string} e.g. `+1 at 5+ PCs` or `+1 at 5+, +2 at 8+`
 */
export function formatReservedPartyScaleHint(reservedInstances) {
  const byMin = new Map();
  for (const el of reservedInstances || []) {
    const min = normalizeMinPartySize(el?.minPartySize);
    if (min <= 1) continue;
    byMin.set(min, (byMin.get(min) || 0) + 1);
  }
  const parts = [...byMin.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([min, count]) => `+${count} at ${min}+`);
  if (parts.length === 0) return '';
  return `${parts.join(', ')} PCs`;
}

/**
 * Header **+**: one Always clone, or one new minion group of `minionGroupSize`.
 * @param {object} template
 * @param {{ isMinion: boolean, characterCount: number }} opts
 * @returns {object[]}
 */
export function planTypeHeaderAdd(template, { isMinion, characterCount }) {
  if (isMinion) {
    return buildMinionGroupElements(stripPartyScaleFields(template), {
      count: minionGroupSize(characterCount),
    });
  }
  return [buildAlwaysPresentClone(template)];
}

/**
 * Header **−**: last instance, or the entire last minion group / ungrouped instance.
 * @param {object[]} instances
 * @param {{ isMinion: boolean }} opts
 * @returns {string[]}
 */
export function planTypeHeaderRemove(instances, { isMinion }) {
  if (!instances?.length) return [];
  if (isMinion) {
    const groups = groupMinionInstances(instances);
    const last = groups[groups.length - 1];
    return (last?.instances || []).map((el) => el.instanceId);
  }
  return [instances[instances.length - 1].instanceId];
}

/**
 * @returns {Array<{ value: number, label: string }>}
 */
export function partyScaleOptions() {
  const opts = [{ value: 1, label: 'Always' }];
  for (let n = 2; n <= PARTY_SCALE_MAX; n += 1) {
    opts.push({ value: n, label: `${n}+ players` });
  }
  return opts;
}

/**
 * Optional Create Scene / picker label suffix.
 * @param {{ minPartySize?: number }|null|undefined} el
 * @returns {string} e.g. ` (5+ players)` or `''`
 */
export function formatPartyScaleNameSuffix(el) {
  const min = normalizeMinPartySize(el?.minPartySize);
  if (min <= 1) return '';
  return ` (${min}+ players)`;
}
