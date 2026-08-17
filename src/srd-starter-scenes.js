/**
 * Pure helpers for SRD starter-scene snapshots (one scene per environment,
 * except Ambushed / Ambushers — those environments stay in the library).
 *
 * Used by `scripts/generate-srd-starter-scenes.mjs`. No DB / Supabase I/O here.
 */

import { computeBudget, computeBattlePoints, computeSceneBudget } from './client/lib/battle-points.js';
import { ROLE_BP_COST } from './game-constants.js';
import { slugifySrdListName } from './srd/srd-list-ids.js';
import { DEFAULT_MAP_SIZE_FT } from './client/lib/map-dimensions-ft.js';

/** Party size used when filling the encounter budget (3×4+2 = 14 BP). */
export const STARTER_SCENE_PARTY_SIZE = 4;

export const STARTER_SCENE_MAP_ID = 'm-1';
export const STARTER_SCENE_VIEW_ID = 'v-1';

export const SCENE_PLACEHOLDER_SVG_WIDTH = 800;
export const SCENE_PLACEHOLDER_SVG_HEIGHT = 600;

export const DEFAULT_STARTER_TABLE_BATTLE_MODS = {
  lessDifficult: false,
  slightlyMoreDangerous: false,
  damageBoostPlusOne: false,
  damageBoostD4: false,
  damageBoostStatic: false,
  moreDangerous: false,
};

/** Event-only environments: keep in the library, do not emit starter scenes. */
export const STARTER_SCENE_EXCLUDED_ENV_IDS = Object.freeze([
  'srd-env-ambushed',
  'srd-env-ambushers',
]);

/** Official catalog cache source for generated starter scenes (ids stay `srd-scene-*`). */
export const STARTER_SCENE_CACHE_SOURCE = 'dt';

/** Skip re-seed when an admin has edited the cache row, unless `--force`. */
export function shouldSkipAdminEditedStarterScene(existingData, { force = false } = {}) {
  return Boolean(existingData?._adminEditedAt) && !force;
}

/** Stable scene ids that must not be upserted (and may be deleted on re-seed). */
export const STARTER_SCENE_EXCLUDED_SCENE_IDS = Object.freeze([
  'srd-scene-ambushed',
  'srd-scene-ambushers',
]);

/**
 * @param {object|null|undefined} env
 * @returns {boolean}
 */
export function shouldGenerateStarterScene(env) {
  const id = env?.id;
  return typeof id === 'string' && id.length > 0 && !STARTER_SCENE_EXCLUDED_ENV_IDS.includes(id);
}

/**
 * @param {string} name — environment display name
 * @returns {string} e.g. `srd-scene-abandoned-grove`
 */
export function makeSrdSceneId(name) {
  return `srd-scene-${slugifySrdListName(name)}`;
}

/**
 * Escape text for embedding in SVG / XML.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * In-memory SVG placeholder (no disk writes).
 * @param {string} name
 * @returns {string}
 */
export function buildScenePlaceholderSvg(name) {
  const label = escapeXml(name);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_PLACEHOLDER_SVG_WIDTH}" height="${SCENE_PLACEHOLDER_SVG_HEIGHT}" viewBox="0 0 ${SCENE_PLACEHOLDER_SVG_WIDTH} ${SCENE_PLACEHOLDER_SVG_HEIGHT}">`,
    `  <rect width="${SCENE_PLACEHOLDER_SVG_WIDTH}" height="${SCENE_PLACEHOLDER_SVG_HEIGHT}" fill="#1a1a2e"/>`,
    `  <text x="400" y="300" text-anchor="middle" dominant-baseline="middle"`,
    `        font-family="Georgia, serif" font-size="64" fill="#e2c97e">`,
    `    ${label}`,
    `  </text>`,
    `</svg>`,
    '',
  ].join('\n');
}

/**
 * @param {unknown} name
 * @returns {boolean}
 */
function isJunkPotentialAdversaryName(name) {
  if (name == null) return false;
  const t = String(name).trim();
  if (!t) return true;
  if (/^any$/i.test(t)) return true;
  // Parser leftovers like `see "Castle on a Hill"` — not real adversary names.
  if (/^see\b/i.test(t)) return true;
  return false;
}

/**
 * @param {Map<string, object>|Record<string, object>|null|undefined} lookup
 * @param {string} id
 * @returns {object|null}
 */
function lookupAdversary(lookup, id) {
  if (!lookup || !id) return null;
  if (typeof lookup.get === 'function') {
    const found = lookup.get(id);
    return found ?? null;
  }
  return lookup[id] ?? null;
}

/**
 * Role variety: first occurrence of each role, then duplicates (stable within each bucket).
 * @param {{ adv: object }[]} items
 */
function sortByRoleVariety(items) {
  const uniqueRole = [];
  const duplicates = [];
  const seen = new Set();
  for (const item of items) {
    const role = String(item.adv?.role || 'standard').toLowerCase();
    if (seen.has(role)) duplicates.push(item);
    else {
      seen.add(role);
      uniqueRole.push(item);
    }
  }
  return [...uniqueRole, ...duplicates];
}

/**
 * Battle-point cost of `adversaries` at `partySize` (minion grouping via computeBattlePoints).
 * Flat per-role costs come from {@link ROLE_BP_COST}.
 * @param {object[]} adversaries
 * @param {number} partySize
 */
function battlePointsForAdversaries(adversaries, partySize) {
  return computeBattlePoints(
    adversaries.map((a) => ({
      role: a.role || 'standard',
      tier: a.tier ?? 1,
      count: 1,
    })),
    partySize,
  );
}

/**
 * Keep only resolvable `potential_adversaries` entries and greedily fill up to
 * `computeBudget(partySize)` without exceeding it. Prefers role variety (one of
 * each role before duplicates). Unresolvable names, `see "…"` junk, and `Any`
 * (which parse to `[]`) yield an empty list.
 *
 * @param {Array<{ adversaryId?: string, name?: string }>|null|undefined} potentialAdversaries
 * @param {Map<string, object>|Record<string, object>} adversaryById
 * @param {number} [partySize=4]
 * @returns {object[]} selected adversary records from the lookup (not cloned)
 */
export function selectAdversariesForStarterScene(
  potentialAdversaries,
  adversaryById,
  partySize = STARTER_SCENE_PARTY_SIZE,
) {
  const budget = computeBudget(partySize);
  const resolvable = [];
  for (const entry of potentialAdversaries || []) {
    if (!entry || typeof entry !== 'object') continue;
    if (isJunkPotentialAdversaryName(entry.name)) continue;
    const id = entry.adversaryId;
    if (!id) continue;
    const adv = lookupAdversary(adversaryById, id);
    if (!adv) continue;
    resolvable.push({ adv, entry });
  }

  const sorted = sortByRoleVariety(resolvable);
  const selected = [];
  for (const { adv } of sorted) {
    // ROLE_BP_COST is the per-role table; minions are grouped, so the gate is
    // always the full running total via computeBattlePoints.
    const role = String(adv.role || 'standard').toLowerCase();
    const flat = ROLE_BP_COST[role];
    if (flat != null && flat > budget && selected.length === 0) continue;

    const nextBp = battlePointsForAdversaries([...selected, adv], partySize);
    if (nextBp > budget) continue;
    selected.push(adv);
  }
  return selected;
}

function cloneJson(value) {
  return structuredClone(value);
}

/**
 * Stable instanceId for the environment element on a starter scene.
 * @param {string} sceneId
 */
export function makeStarterEnvironmentInstanceId(sceneId) {
  return `${sceneId}-el-env`;
}

/**
 * Stable instanceId for an adversary element (env + adversary id + index).
 * @param {string} sceneId
 * @param {string} adversaryId
 * @param {number} index
 */
export function makeStarterAdversaryInstanceId(sceneId, adversaryId, index) {
  return `${sceneId}-el-adv-${adversaryId}-${index}`;
}

/**
 * Build a flat table_state-shaped scene snapshot for one SRD environment.
 *
 * @param {object} env — normalized SRD environment (`name`, `description`, `potential_adversaries`, …)
 * @param {{
 *   adversaryById: Map<string, object>|Record<string, object>,
 *   mapImageUrl: string,
 *   partySize?: number,
 * }} opts
 * @returns {object}
 */
export function buildSrdStarterScene(env, opts = {}) {
  const adversaryById = opts.adversaryById || {};
  const mapImageUrl = opts.mapImageUrl ?? '';
  const partySize = opts.partySize ?? STARTER_SCENE_PARTY_SIZE;

  const name = env?.name || '';
  const sceneId = makeSrdSceneId(name);
  const selected = selectAdversariesForStarterScene(
    env?.potential_adversaries,
    adversaryById,
    partySize,
  );

  const envClone = cloneJson(env && typeof env === 'object' ? env : {});
  const envElement = {
    ...envClone,
    instanceId: makeStarterEnvironmentInstanceId(sceneId),
    elementType: 'environment',
  };

  const adversaryElements = selected.map((adv, index) => {
    const clone = cloneJson(adv);
    return {
      ...clone,
      instanceId: makeStarterAdversaryInstanceId(sceneId, adv.id || `idx-${index}`, index),
      elementType: 'adversary',
      currentHp: adv.hp_max ?? 0,
      currentStress: 0,
      conditions: '',
    };
  });

  const scene = {
    id: sceneId,
    name,
    description: env?.description || '',
    _source: 'dt',
    maps: [
      {
        id: STARTER_SCENE_MAP_ID,
        name,
        mapImageUrl,
        mapDimension: 'width',
        mapSizeFt: DEFAULT_MAP_SIZE_FT,
        mapImageNaturalWidth: SCENE_PLACEHOLDER_SVG_WIDTH,
        mapImageNaturalHeight: SCENE_PLACEHOLDER_SVG_HEIGHT,
        mapAiImagePrompt: null,
        shareWithPlayers: true,
      },
    ],
    mapViews: [
      {
        id: STARTER_SCENE_VIEW_ID,
        mapId: STARTER_SCENE_MAP_ID,
        name: 'Main',
        mapViewZoomRatio: null,
        mapViewPanNorm: null,
        mapViewVisibleNorm: null,
        broadcastToPlayers: true,
        locked: false,
      },
    ],
    gmActiveViewId: STARTER_SCENE_VIEW_ID,
    activeMapId: STARTER_SCENE_MAP_ID,
    gmMapView: {
      mapId: STARTER_SCENE_MAP_ID,
      mapViewZoomRatio: null,
      mapViewPanNorm: null,
      mapViewVisibleNorm: null,
    },
    activeElements: [envElement, ...adversaryElements],
    tableBattleMods: { ...DEFAULT_STARTER_TABLE_BATTLE_MODS },
    sessionCountdowns: [],
    conditionsHistory: [],
    partySize,
    partyTier: 1,
  };

  const budget = computeSceneBudget(scene, partySize, scene.partyTier);
  scene.tier = budget.tier ?? env?.tier ?? 1;
  scene.bp = budget.bp;
  return scene;
}

/**
 * @param {object[]} environments
 * @param {{ adversaryById: object, mapImageUrl: string, partySize?: number }} opts
 * @returns {object[]}
 */
export function buildSrdStarterScenes(environments, opts) {
  return (environments || [])
    .filter(shouldGenerateStarterScene)
    .map((env) => buildSrdStarterScene(env, opts));
}
