import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';
import {
  legacyKeyFromSourceRef,
  normalizeSessionCountdownEntry,
  sessionCountdownMatchesLegacyKey,
} from './session-countdowns.js';
import { normalizeConditionsToList, serializeConditionsList } from './conditions-utils.js';
import {
  addConditionsHistoryEntry,
  removeConditionsHistoryEntry,
} from './conditions-history.js';
import {
  DEFAULT_LEGACY_MAP_ID,
  deriveMapConfigFromState,
  newMapId,
  newViewId,
  normalizeMapState,
} from './map-table-state.js';
import { DEFAULT_MAP_SIZE_FT } from './map-dimensions-ft.js';
import { playerCanAccessMapViewSelection } from './map-view-player-sync.js';
import { normalizeMapArtistFields } from './map-artist.js';
import { normalizeNextScenes } from './scene-load-dialog.js';
import { syncLibraryMapOntoTableMaps } from './map-library.js';
import { applyInventoryMove, normalizePartyLoot } from './party-loot.js';

/** Keep legacy `gmMapView` + `activeMapId` aligned with `gmActiveViewId` for snapshots. */
function syncGmMapViewFromActiveView(state) {
  if (state.gmActiveViewId == null) return;
  const v = state.mapViews?.find(x => x.id === state.gmActiveViewId) || state.mapViews?.[0];
  if (!v) return;
  state.activeMapId = v.mapId;
  state.gmMapView = {
    mapId: v.mapId,
    mapViewZoomRatio: v.mapViewZoomRatio ?? null,
    mapViewPanNorm: v.mapViewPanNorm ?? null,
    mapViewVisibleNorm: v.mapViewVisibleNorm ?? null,
  };
}

// Runtime fields that are local to the Game Table and NOT overwritten by library data.
// Used when resolving characters by reference: library base data is merged in, but
// these fields are preserved from the stored activeElement.
// Any _ prefixed key on a character element is also preserved automatically
// (ancestry/class feature state uses _ prefix by convention, e.g. _fearlessToggle).
export const CHARACTER_RUNTIME_KEYS = [
  'instanceId', 'elementType',
  'currentHp', 'currentStress', 'hope', 'currentArmor', 'conditions',
  'tokenX', 'tokenY',
  /** Vertical offset in feet (0 = ground). Implicit default; omitted until the user changes it. */
  'altitude',
  /** Which parallel map this token is on when placed (`null` = tray / unassigned). */
  'mapId',
  'assignedPlayerEmail', 'assignedPlayerUid', 'playerName',
  'reinforcedActive',
  'selectedExperienceIndex',  // which experience is selected for the next roll (+2)
  // Feature interaction state
  'featureUsage',      // { [featureKey]: { used: boolean, cycle: 'session'|'rest'|'longRest' } }
  'activeModifiers',   // [{ id, name, dice?, value?, mode?, bonus?, trait?, type, refreshOn }]
  'focusTargetId',     // Ranger's Focus (mirrors focusTargetInstanceId for persisted table rows)
  'focusTargetInstanceId',
  'rangerFocusOnNextAttack',  // Ranger's Focus: use on next weapon attack (toggle)
  'companion',         // Beastbound: { name, species, evasion, maxStress, currentStress }; table stress preserved
  'activeBeastform',           // Druid: current beastform object or null
  'selectedBeastformAdvantage', // Druid: currently selected beastform advantage label or null
  'faerieWingsFlying',        // Faerie Wings: whether the character is currently flying (for Wings chip)
  'retractedActive',           // Galapa Retract: in shell (toggle state for card chip)
  'resistance',                // [{ type, source }] e.g. physical from Galapa Retract
  'disadvantageSources',       // string[] sources that add disadvantage to this character's rolls
  'moveDisabledSources',       // string[] sources that prevent token move (e.g. Retract)
  'lockedOnTargetInstanceId',  // Locked On (weapon): instanceId of target; next primary attack vs them auto-succeeds, cleared on ack
  /**
   * V2 engine: per-character persistent feature bags (`{ [featureKey]: { ... } }`), merged with
   * optional table-level `featureState` in `mergeDeclarativeFeatureState` (see `src/features-v2/engine/feature-loader.js`).
   */
  'featureState',
  /**
   * Keys under `featureState[featureKey]` that were written via `table.feature.set` / `table.source.set`
   * (`manual: true` mutations) — used for the Game Table **Feature state** sidebar only.
   */
  'featureStateDeclared',
  /** Seraph — session Prayer Dice pool (`{ pool: number[] }`); must persist for V2 card/review chips. */
  'prayerDice',
  /** Game Table: optional display labels for weapons/features/domain cards (`{ weapons?, features?, abilities? }`). */
  'sheetDisplayNames',
  /** V2: pending map move for a banner (`move()` mutation); includes `conditionMet`; cleared on banner ack/cancel. */
  'v2PendingMove',
  /** V2: frozen actor during `move(..., freezeOther)` — pairs with `moveDisabledSources` row for that banner. */
  'v2MoveLockRollDbId',
  'v2MoveLockSource',
  /** Game Table runtime: gold integer (ones=handfuls, tens=bags, hundreds+=chests). */
  'gold',
  /** Game Table runtime: inventory rows `{ uid, name, quantity, id?, refCollection? }`. */
  'inventory',
];

/**
 * Optional top-level keys on the `table_state` JSON document (alongside `elements`, `fearCount`,
 * `partyLoot`, …) used by the V2 engine for **session-wide** `gameState.featureState` (e.g. Bard Rally
 * `partyDice` on the Rally `featureState` bag when the host merges table + character state).
 * The DB stores the full `table_state` blob; these keys are not stripped (only character elements are stripped).
 * `partyLoot` (`{ gold, inventory }`) is table-root loot — not a V2 feature bag; `clear-table` /
 * `replace-scene-snapshot` leave it untouched.
 */
export const TABLE_STATE_V2_ROOT_KEYS = ['featureState'];

/**
 * Shape for `elementType: 'mapImage'` — a placeable, resizable image object on the battle map.
 * Stored in `activeElements` like any other element; generic `add-elements`, `update-element`,
 * and `remove-element` ops already handle it without special-casing.
 * `clear-table` drops mapImage elements because they are not characters or character boardTokens.
 *
 * Fields:
 *   instanceId          — unique id
 *   elementType         — 'mapImage'
 *   mapId               — which parallel map it belongs to (null = unplaced)
 *   imageUrl            — public URL (never an inline data: URL — server guard strips those)
 *   imageNaturalWidth   — original px width (for aspect-ratio locking)
 *   imageNaturalHeight  — original px height
 *   tokenX, tokenY      — center position in feet (same convention as token elements; null = not placed)
 *   widthFt             — current rendered width in feet (aspect-ratio locked)
 *   heightFt            — current rendered height in feet (= widthFt * naturalH/naturalW)
 */

/** Persisted fields for `elementType: 'boardToken'` (companion token, etc.). */
export const BOARD_TOKEN_RUNTIME_KEYS = [
  'instanceId',
  'elementType',
  'parentInstanceId',
  'virtualTokenId',
  'tokenKind',
  'label',
  'tokenX',
  'tokenY',
  'altitude',
  'mapId',
];

export const RUNTIME_KEYS = [
  'instanceId', 'elementType', 'currentHp', 'currentStress', 'conditions', 'hope', 'maxHope',
  'playerName', 'maxHp', 'maxStress', 'name',
  'daggerstackUrl', 'daggerstackEmail', 'daggerstackPassword', 'daggerstackCharacterId',
  'class', 'subclass', 'level', 'pronouns', 'description', 'ancestry', 'community',
  'domains', 'traits', 'evasion', 'armorScore', 'armorName', 'armorThresholds',
  'maxArmor', 'currentArmor', 'weapons', 'gold', 'inventory',
  'classFeatures', 'subclassFeatures', 'ancestryFeatures', 'communityFeatures',
  'experiences', 'spellcastTrait', 'hopeAbility', 'hopeAbilityName', 'companion', 'tier',
  'tokenX', 'tokenY',
  'altitude',
  'mapId',
  'classId', 'subclassId', 'ancestryIds', 'communityId',
  'armorId', 'primaryWeaponId', 'secondaryWeaponId',
  'abilityIds', 'abilities', 'baseTraits', 'advancements', 'proficiency',
  'domainLoadoutIds', 'multiclassClassId', 'multiclassSubclassId', 'multiclassDomain', 'spellcastTraitSource',
  'background', 'connectionText', 'hopeFeature',
  'weaponMods', 'armorMods',
  'difficultyMod',     // Make a Scene: cumulative difficulty modifier applied by Bard feature
  'vulnerable',        // Retracting Claws (Katari): adversary condition, apply on successful attack
  'focusedBy',         // Ranger's Focus: character name who has this adversary as Focus
  'v2PendingMove',     // V2: pending map positioning for a banner (see CHARACTER_RUNTIME_KEYS)
  'v2MoveLockRollDbId',
  'v2MoveLockSource',
];

/**
 * Fields preserved from the existing element when applying `update-base-data` after a library save
 * from the Game Table (adversaries, environments, etc.). Excludes library-shaped keys (`name`,
 * `tier`, `features`, …) so merged `newBaseData` from the server replaces stale stub/base fields.
 * `_`-prefixed keys are preserved like `character-library-update` (e.g. `_scaledFromTier`).
 */
export const UPDATE_BASE_DATA_RUNTIME_KEYS = [
  'instanceId', 'elementType',
  'currentHp', 'currentStress', 'conditions',
  'tokenX', 'tokenY',
  'altitude',
  'mapId',
  'weaponMods', 'armorMods',
  'difficultyMod',
  'vulnerable',
  'focusedBy',
  'v2PendingMove',
  'v2MoveLockRollDbId',
  'v2MoveLockSource',
  'minPartySize',
  'minionGroupId',
  'minionGroupParkedPlacements',
  /** GM-only: `false` hides this adversary from players (default visible). */
  'visibleToPlayers',
];

/**
 * Apply a table operation to GM-side state (pure function).
 * Returns an object containing only the state keys that changed.
 */
export function applyTableOp(op, state) {
  const { activeElements = [], featureCountdowns = {}, sessionCountdowns: sessionCountdownsRaw = [] } = state;
  const sessionCountdowns = Array.isArray(sessionCountdownsRaw) ? sessionCountdownsRaw : [];
  switch (op.op) {
    case 'update-element':
      return { activeElements: activeElements.map(el => el.instanceId === op.instanceId ? { ...el, ...op.updates } : el) };
    case 'update-elements': {
      // Batch update: op.updates is [{ instanceId, updates }] — all applied atomically in one server round-trip.
      const map = {};
      for (const { instanceId, updates } of (op.updates || [])) {
        map[instanceId] = { ...(map[instanceId] || {}), ...updates };
      }
      return { activeElements: activeElements.map(el => map[el.instanceId] ? { ...el, ...map[el.instanceId] } : el) };
    }
    case 'add-elements':
      return { activeElements: [...activeElements, ...op.elements] };
    case 'remove-element': {
      const removed = activeElements.find((el) => el.instanceId === op.instanceId);
      return {
        activeElements: activeElements.filter((el) => {
          if (el.instanceId === op.instanceId) return false;
          if (
            removed?.elementType === 'character' &&
            el.elementType === 'boardToken' &&
            el.parentInstanceId === removed.instanceId
          ) {
            return false;
          }
          return true;
        }),
      };
    }
    case 'clear-table': {
      const chars = activeElements.filter((el) => el.elementType === 'character');
      const charIds = new Set(chars.map((c) => c.instanceId));
      const boardKept = activeElements.filter(
        (el) => el.elementType === 'boardToken' && charIds.has(el.parentInstanceId),
      );
      return {
        activeElements: [...chars, ...boardKept],
        featureCountdowns: {},
        sessionCountdowns: [],
      };
    }
    case 'set-fear':
      return { fearCount: op.fearCount };
    case 'set-party-loot': {
      const current = normalizePartyLoot(state.partyLoot);
      const next = { ...current };
      if ('gold' in op && op.gold !== undefined) {
        next.gold = Math.max(0, Math.floor(Number(op.gold) || 0));
      }
      if ('inventory' in op) {
        next.inventory = normalizePartyLoot({ inventory: op.inventory }).inventory;
      }
      return { partyLoot: next };
    }
    case 'move-inventory-item':
      return applyInventoryMove(state, { from: op.from, to: op.to, uid: op.uid });
    case 'set-spotlight':
      return { spotlight: op.spotlight };
    case 'add-conditions-history-entry':
      return {
        conditionsHistory: addConditionsHistoryEntry(state.conditionsHistory, op.entry),
      };
    case 'remove-conditions-history-entry':
      return {
        conditionsHistory: removeConditionsHistoryEntry(state.conditionsHistory, op.entry),
      };
    case 'set-countdown': {
      const key = op.key;
      const value = op.value;
      const nextFc = { ...featureCountdowns, [key]: value };
      let touched = false;
      const nextSession = sessionCountdowns.map((sc) => {
        if (!sessionCountdownMatchesLegacyKey(sc, key)) return sc;
        touched = true;
        return normalizeSessionCountdownEntry({ ...sc, current: value });
      });
      if (!touched) return { featureCountdowns: nextFc };
      return { featureCountdowns: nextFc, sessionCountdowns: nextSession };
    }
    case 'session-countdown-upsert': {
      const entry = normalizeSessionCountdownEntry(op.entry || {});
      if (!entry.id) return {};
      const list = [...sessionCountdowns];
      const idx = list.findIndex((x) => x.id === entry.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      else list.push(entry);
      const out = { sessionCountdowns: list };
      if (entry.sourceRef) {
        const lk = legacyKeyFromSourceRef(entry.sourceRef);
        out.featureCountdowns = { ...featureCountdowns, [lk]: entry.current };
      }
      return out;
    }
    case 'session-countdown-remove': {
      const id = op.id;
      if (!id) return {};
      return { sessionCountdowns: sessionCountdowns.filter((c) => c.id !== id) };
    }
    case 'session-countdown-patch': {
      const id = op.id;
      const patch = op.patch || {};
      if (!id) return {};
      const list = sessionCountdowns.map((c) => {
        if (c.id !== id) return c;
        return normalizeSessionCountdownEntry({ ...c, ...patch });
      });
      const out = { sessionCountdowns: list };
      const row = list.find((c) => c.id === id);
      if (row?.sourceRef && patch.current !== undefined) {
        out.featureCountdowns = {
          ...featureCountdowns,
          [legacyKeyFromSourceRef(row.sourceRef)]: row.current,
        };
      }
      return out;
    }
    case 'session-countdown-batch': {
      const updates = op.updates;
      if (!Array.isArray(updates) || updates.length === 0) return {};
      const map = new Map(updates.map((u) => [u.id, u.current]));
      const list = sessionCountdowns.map((c) => {
        if (!map.has(c.id)) return c;
        return normalizeSessionCountdownEntry({ ...c, current: map.get(c.id) });
      });
      const fc = { ...featureCountdowns };
      for (const c of list) {
        if (c.sourceRef && map.has(c.id)) {
          fc[legacyKeyFromSourceRef(c.sourceRef)] = c.current;
        }
      }
      return { sessionCountdowns: list, featureCountdowns: fc };
    }
    case 'set-battle-mods':
      return { tableBattleMods: op.tableBattleMods };
    // Used by "Add Scene to Table": append remapped maps/views/elements/countdowns
    // from a library scene snapshot. `tableBattleMods` replaces the table's factors
    // only when present (GM chose "Apply Scene Factors"); omit to keep current factors.
    // `nextScenes` replaces the table's Next Scenes list when present (including `[]`).
    case 'add-scene-snapshot': {
      const out = {
        maps: [...(state.maps || []), ...(op.maps || [])],
        mapViews: [...(state.mapViews || []), ...(op.mapViews || [])],
        activeElements: [...activeElements, ...(op.elements || [])],
      };
      if (Array.isArray(op.sessionCountdowns)) {
        out.sessionCountdowns = [...sessionCountdowns, ...op.sessionCountdowns];
      }
      if ('tableBattleMods' in op) {
        out.tableBattleMods = op.tableBattleMods;
      }
      if (Array.isArray(op.nextScenes)) {
        out.nextScenes = normalizeNextScenes(op.nextScenes);
      }
      return out;
    }
    // Load Scene → Replace: drop scene dressing (maps, mapViews, adversaries,
    // environments, notes, mapImage, drawShape, sessionCountdowns), keep
    // characters + attached companion boardTokens (returned to tray), then
    // append the remapped snapshot. Fear, player emails, session top, and
    // other table meta are unchanged (not in the returned patch).
    // `nextScenes` replaces the table's Next Scenes list when present (including `[]`).
    case 'replace-scene-snapshot': {
      const chars = activeElements.filter((el) => el.elementType === 'character');
      const charIds = new Set(chars.map((c) => c.instanceId));
      const boardKept = activeElements.filter(
        (el) => el.elementType === 'boardToken' && charIds.has(el.parentInstanceId),
      );
      const unplace = (el) => {
        if (el.tokenX == null && el.tokenY == null && el.mapId == null && (el.altitude == null || el.altitude === 0)) {
          return el;
        }
        return { ...el, tokenX: null, tokenY: null, mapId: null, altitude: 0 };
      };
      const maps = [...(op.maps || [])];
      const mapViews = [...(op.mapViews || [])];
      const firstMapId = maps[0]?.id ?? null;
      const firstViewId = (firstMapId && mapViews.find((v) => v.mapId === firstMapId)?.id)
        || mapViews[0]?.id
        || null;
      const out = {
        maps,
        mapViews,
        activeElements: [...chars.map(unplace), ...boardKept.map(unplace), ...(op.elements || [])],
        sessionCountdowns: Array.isArray(op.sessionCountdowns) ? [...op.sessionCountdowns] : [],
        activeMapId: firstMapId,
        gmActiveViewId: firstViewId,
      };
      if (maps.length) {
        const nextState = { ...state, ...out };
        syncGmMapViewFromActiveView(nextState);
        out.gmMapView = nextState.gmMapView;
        out.mapConfig = deriveMapConfigFromState(nextState);
      }
      if ('tableBattleMods' in op) {
        out.tableBattleMods = op.tableBattleMods;
      }
      if (Array.isArray(op.nextScenes)) {
        out.nextScenes = normalizeNextScenes(op.nextScenes);
      }
      return out;
    }
    case 'set-player-emails':
      return { playerEmails: op.playerEmails };
    case 'add-player-email': {
      const email = typeof op.email === 'string' ? op.email.trim().toLowerCase() : '';
      if (!email) return {};
      const existing = Array.isArray(state.playerEmails) ? state.playerEmails : [];
      if (existing.some((e) => String(e).trim().toLowerCase() === email)) return {};
      return { playerEmails: [...existing, email] };
    }
    case 'set-player-name': {
      const email = typeof op.email === 'string' ? op.email.trim().toLowerCase() : '';
      const name = typeof op.name === 'string' ? op.name.trim() : '';
      if (!email || !name || name === email) return {};
      const playerNames = { ...(state.playerNames || {}), [email]: name };
      return { playerNames };
    }
    case 'remove-player-email': {
      const email = typeof op.email === 'string' ? op.email.trim().toLowerCase() : '';
      if (!email) return {};
      const existing = Array.isArray(state.playerEmails) ? state.playerEmails : [];
      const playerEmails = existing.filter((e) => String(e).trim().toLowerCase() !== email);
      const nextEls = activeElements.map((el) => {
        if (el.elementType !== 'character') return el;
        const assigned = el.assignedPlayerEmail;
        if (typeof assigned !== 'string' || assigned.trim().toLowerCase() !== email) return el;
        const next = { ...el };
        delete next.assignedPlayerEmail;
        delete next.assignedPlayerUid;
        return next;
      });
      return { playerEmails, activeElements: nextEls };
    }
    case 'update-base-data': {
      return {
        activeElements: activeElements.map(el => {
          if (el.id !== op.elementId) return el;
          const runtime = {};
          UPDATE_BASE_DATA_RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
          Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
          return { ...op.newBaseData, ...runtime };
        }),
      };
    }
    case 'character-library-update': {
      return {
        activeElements: activeElements.map(el => {
          if (el.elementType !== 'character' || el.id !== op.characterId) return el;
          const runtime = {};
          CHARACTER_RUNTIME_KEYS.forEach(k => {
            if (k === 'companion') return;
            if (k in el) runtime[k] = el[k];
          });
          // Auto-preserve any _ prefixed keys (ancestry/class feature toggle state).
          Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
          const merged = { ...op.newBaseData, ...runtime, elementType: 'character' };
          if (op.newBaseData.companion || el.companion) {
            merged.companion = { ...(op.newBaseData.companion || {}), currentStress: el.companion?.currentStress };
          }
          return merged;
        }),
      };
    }
    case 'set-map': {
      const base = normalizeMapState(state);
      const targetMapId = op.mapId ?? base.activeMapId;
      const targetMapBefore = base.maps.find(m => m.id === targetMapId);
      const prevImageUrl = targetMapBefore?.mapImageUrl;
      let imageUrlChanged = false;
      const maps = base.maps.map(m => {
        if (m.id !== targetMapId) return m;
        const merged = { ...m };
        if (op.mapImageUrl !== undefined) {
          merged.mapImageUrl = op.mapImageUrl;
          imageUrlChanged = String(op.mapImageUrl ?? '') !== String(prevImageUrl ?? '');
          if (op.mapImageUrl !== undefined && (op.mapImageUrl === null || op.mapImageUrl === '')) {
            merged.mapAiImagePrompt = null;
          }
        }
        if (op.mapDimension !== undefined) merged.mapDimension = op.mapDimension;
        if (op.mapSizeFt !== undefined) merged.mapSizeFt = op.mapSizeFt;
        if (op.mapImageNaturalWidth !== undefined) merged.mapImageNaturalWidth = op.mapImageNaturalWidth;
        if (op.mapImageNaturalHeight !== undefined) merged.mapImageNaturalHeight = op.mapImageNaturalHeight;
        if (op.mapAiImagePrompt !== undefined) merged.mapAiImagePrompt = op.mapAiImagePrompt;
        if (op.shareWithPlayers !== undefined) merged.shareWithPlayers = !!op.shareWithPlayers;
        if (op.libraryMapId !== undefined) merged.libraryMapId = op.libraryMapId;
        if (op.librarySyncImage !== undefined) merged.librarySyncImage = !!op.librarySyncImage;
        if (op.artist !== undefined || op.artistUrl !== undefined) {
          const credit = normalizeMapArtistFields(
            op.artist !== undefined ? op.artist : m.artist,
            op.artistUrl !== undefined ? op.artistUrl : m.artistUrl,
          );
          merged.artist = credit.artist;
          merged.artistUrl = credit.artistUrl;
        }
        if (op.overlayPng !== undefined) {
          if (op.overlayPng == null) delete merged.overlayPng;
          else merged.overlayPng = op.overlayPng;
        }
        return merged;
      });
      let mapViews = base.mapViews.map(v => ({ ...v }));
      const shouldResetMapView = op.resetTokenPositions || imageUrlChanged;
      if (shouldResetMapView) {
        mapViews = mapViews.map(v =>
          v.mapId === targetMapId
            ? { ...v, mapViewZoomRatio: null, mapViewPanNorm: null, mapViewVisibleNorm: null }
            : v
        );
      }
      const nextState = { ...base, maps, mapViews };
      if (shouldResetMapView && nextState.gmMapView?.mapId === targetMapId) {
        nextState.gmMapView = {
          ...nextState.gmMapView,
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          mapViewVisibleNorm: null,
        };
      }
      syncGmMapViewFromActiveView(nextState);
      const mapConfig = deriveMapConfigFromState(nextState);
      let nextEls = activeElements;
      if (op.resetTokenPositions) {
        nextEls = activeElements.map(el => {
          if (el.tokenX == null || el.tokenY == null) return el;
          const mid = el.mapId ?? DEFAULT_LEGACY_MAP_ID;
          if (mid !== targetMapId) return el;
          return { ...el, tokenX: null, tokenY: null, mapId: null, altitude: 0 };
        });
      }
      return {
        maps,
        mapViews,
        activeMapId: nextState.activeMapId,
        gmActiveViewId: nextState.gmActiveViewId,
        gmMapView: nextState.gmMapView,
        mapConfig,
        ...(nextEls !== activeElements ? { activeElements: nextEls } : {}),
      };
    }
    case 'set-map-view': {
      const base = normalizeMapState(state);
      /** Framing not tied to a named view — only `gmMapView` updates. */
      if (base.gmActiveViewId === null) {
        const mid = op.mapId ?? base.gmMapView?.mapId ?? base.activeMapId;
        if (!mid || !base.maps.some(m => m.id === mid)) return {};
        const nextGm = {
          mapId: mid,
          mapViewZoomRatio: op.mapViewZoomRatio !== undefined ? op.mapViewZoomRatio : base.gmMapView?.mapViewZoomRatio ?? null,
          mapViewPanNorm: op.mapViewPanNorm !== undefined ? op.mapViewPanNorm : base.gmMapView?.mapViewPanNorm ?? null,
          mapViewVisibleNorm:
            op.mapViewVisibleNorm !== undefined ? op.mapViewVisibleNorm : base.gmMapView?.mapViewVisibleNorm ?? null,
        };
        const nextState = { ...base, gmMapView: nextGm, activeMapId: mid, gmActiveViewId: null };
        return {
          maps: nextState.maps,
          mapViews: nextState.mapViews,
          activeMapId: mid,
          gmActiveViewId: null,
          gmMapView: nextGm,
          mapConfig: deriveMapConfigFromState(nextState),
        };
      }
      const viewId = op.viewId ?? base.gmActiveViewId;
      const mapViews = base.mapViews.map(v => {
        if (v.id !== viewId) return v;
        return {
          ...v,
          ...(op.mapViewZoomRatio !== undefined ? { mapViewZoomRatio: op.mapViewZoomRatio } : {}),
          ...(op.mapViewPanNorm !== undefined ? { mapViewPanNorm: op.mapViewPanNorm } : {}),
          ...(op.mapViewVisibleNorm !== undefined ? { mapViewVisibleNorm: op.mapViewVisibleNorm } : {}),
        };
      });
      const nextState = { ...base, mapViews };
      syncGmMapViewFromActiveView(nextState);
      return {
        maps: nextState.maps,
        mapViews,
        activeMapId: nextState.activeMapId,
        gmActiveViewId: nextState.gmActiveViewId,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'set-map-free-explore': {
      const base = normalizeMapState(state);
      const mapId = op.mapId;
      if (!mapId || !base.maps.some(m => m.id === mapId)) return {};
      const nextState = {
        ...base,
        gmActiveViewId: null,
        activeMapId: mapId,
        gmMapView: {
          mapId,
          mapViewZoomRatio: op.mapViewZoomRatio ?? null,
          mapViewPanNorm: op.mapViewPanNorm ?? null,
          mapViewVisibleNorm: op.mapViewVisibleNorm ?? null,
        },
      };
      return {
        maps: nextState.maps,
        mapViews: nextState.mapViews,
        activeMapId: mapId,
        gmActiveViewId: null,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'set-active-view': {
      const base = normalizeMapState(state);
      const vid = op.viewId;
      if (!vid || !base.mapViews.some(v => v.id === vid)) return {};
      const nextState = { ...base, gmActiveViewId: vid };
      const view = nextState.mapViews.find(v => v.id === vid);
      nextState.activeMapId = view.mapId;
      syncGmMapViewFromActiveView(nextState);
      return {
        mapViews: nextState.mapViews,
        activeMapId: nextState.activeMapId,
        gmActiveViewId: vid,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'force-player-map-view': {
      const base = normalizeMapState(state);
      const viewId = op.viewId ?? null;
      const freeMapExploreMapId = op.freeMapExploreMapId ?? null;
      if (viewId) {
        const focus = { viewId, freeMapExploreMapId: null };
        if (!playerCanAccessMapViewSelection({ maps: base.maps, mapViews: base.mapViews }, focus)) return {};
        const prevSeq = state.playerMapViewFocus?.seq ?? 0;
        return {
          playerMapViewFocus: {
            seq: prevSeq + 1,
            viewId,
            freeMapExploreMapId: null,
          },
        };
      }
      if (freeMapExploreMapId) {
        const focus = { viewId: null, freeMapExploreMapId };
        if (!playerCanAccessMapViewSelection({ maps: base.maps, mapViews: base.mapViews }, focus)) return {};
        const prevSeq = state.playerMapViewFocus?.seq ?? 0;
        return {
          playerMapViewFocus: {
            seq: prevSeq + 1,
            viewId: null,
            freeMapExploreMapId,
          },
        };
      }
      return {};
    }
    case 'set-active-map': {
      const base = normalizeMapState(state);
      const targetId = op.activeMapId;
      if (!targetId || !base.maps.some(m => m.id === targetId)) return {};
      const firstView = base.mapViews.find(v => v.mapId === targetId);
      if (!firstView) return {};
      const nextState = { ...base, gmActiveViewId: firstView.id, activeMapId: targetId };
      syncGmMapViewFromActiveView(nextState);
      return {
        activeMapId: targetId,
        gmActiveViewId: firstView.id,
        gmMapView: nextState.gmMapView,
        mapViews: nextState.mapViews,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'add-map-view': {
      const base = normalizeMapState(state);
      const cur = base.gmActiveViewId
        ? base.mapViews.find(v => v.id === base.gmActiveViewId)
        : base.mapViews.find(v => v.mapId === base.gmMapView?.mapId) || base.mapViews[0];
      if (!cur) return {};
      const mapId = cur.mapId;
      const siblings = base.mapViews.filter(v => v.mapId === mapId);
      const name =
        op.name && String(op.name).trim()
          ? String(op.name).trim()
          : `View ${siblings.length + 1}`;
      const fromFreeExplore = base.gmActiveViewId == null;
      const newView = {
        id: newViewId(),
        mapId,
        name,
        mapViewZoomRatio:
          op.mapViewZoomRatio ??
          (fromFreeExplore ? base.gmMapView?.mapViewZoomRatio : cur.mapViewZoomRatio) ??
          null,
        mapViewPanNorm:
          op.mapViewPanNorm ?? (fromFreeExplore ? base.gmMapView?.mapViewPanNorm : cur.mapViewPanNorm) ?? null,
        mapViewVisibleNorm:
          op.mapViewVisibleNorm ??
          (fromFreeExplore ? base.gmMapView?.mapViewVisibleNorm : cur.mapViewVisibleNorm) ??
          null,
        broadcastToPlayers: false,
      };
      const mapViews = [...base.mapViews, newView];
      const nextState = { ...base, mapViews, gmActiveViewId: newView.id };
      nextState.activeMapId = mapId;
      syncGmMapViewFromActiveView(nextState);
      return {
        mapViews,
        activeMapId: mapId,
        gmActiveViewId: newView.id,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'remove-map-view': {
      const base = normalizeMapState(state);
      const vid = op.viewId;
      if (!vid) return {};
      const victim = base.mapViews.find(v => v.id === vid);
      if (!victim) return {};
      const remainingOnMap = base.mapViews.filter(v => v.mapId === victim.mapId && v.id !== vid);
      if (remainingOnMap.length < 1) return {};
      let mapViews = base.mapViews.filter(v => v.id !== vid);
      let gmActiveViewId = base.gmActiveViewId;
      if (gmActiveViewId === vid) {
        gmActiveViewId = remainingOnMap[0].id;
      }
      const nextState = { ...base, mapViews, gmActiveViewId };
      const av = mapViews.find(v => v.id === gmActiveViewId);
      nextState.activeMapId = av.mapId;
      syncGmMapViewFromActiveView(nextState);
      return {
        mapViews,
        activeMapId: nextState.activeMapId,
        gmActiveViewId,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'rename-map-view': {
      const base = normalizeMapState(state);
      const vid = op.viewId;
      const name = op.name != null ? String(op.name).trim() : '';
      if (!vid || !name) return {};
      const mapViews = base.mapViews.map(v => (v.id === vid ? { ...v, name } : v));
      const nextState = { ...base, mapViews };
      return { mapViews, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'set-view-broadcast': {
      const base = normalizeMapState(state);
      const vid = op.viewId;
      if (!vid || !base.mapViews.some(v => v.id === vid)) return {};
      const mapViews = base.mapViews.map(v =>
        v.id === vid ? { ...v, broadcastToPlayers: !!op.broadcastToPlayers } : v
      );
      const nextState = { ...base, mapViews };
      return { mapViews, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'set-view-locked': {
      const base = normalizeMapState(state);
      const vid = op.viewId;
      if (!vid || !base.mapViews.some(v => v.id === vid)) return {};
      const mapViews = base.mapViews.map(v =>
        v.id === vid ? { ...v, locked: !!op.locked } : v
      );
      const nextState = { ...base, mapViews };
      return { mapViews, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'set-map-share': {
      const base = normalizeMapState(state);
      const mid = op.mapId;
      if (!mid || !base.maps.some(m => m.id === mid)) return {};
      const maps = base.maps.map(m =>
        m.id === mid ? { ...m, shareWithPlayers: !!op.shareWithPlayers } : m
      );
      const nextState = { ...base, maps };
      return { maps, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'set-map-overlay':
    case 'set-map-fog': {
      const base = normalizeMapState(state);
      const mapId = op.mapId;
      if (!mapId || !base.maps.some(m => m.id === mapId)) return {};
      const nextPng = op.overlayPng ?? op.fogPng;
      if (nextPng !== null && nextPng !== undefined && typeof nextPng !== 'string') return {};
      const maps = base.maps.map((m) => {
        if (m.id !== mapId) return m;
        if (nextPng === null || nextPng === undefined) {
          const next = { ...m };
          delete next.overlayPng;
          delete next.fogPng;
          return next;
        }
        const next = { ...m, overlayPng: nextPng };
        delete next.fogPng;
        return next;
      });
      const nextState = { ...base, maps };
      return {
        maps,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'set-map-view-overlay':
    case 'set-map-view-fog': {
      const base = normalizeMapState(state);
      const viewId = op.viewId;
      if (!viewId || !base.mapViews.some(v => v.id === viewId)) return {};
      const nextPng = op.overlayPng ?? op.fogPng;
      if (nextPng !== null && nextPng !== undefined && typeof nextPng !== 'string') return {};
      const mapViews = base.mapViews.map((v) => {
        if (v.id !== viewId) return v;
        if (nextPng === null || nextPng === undefined) {
          const next = { ...v };
          delete next.overlayPng;
          delete next.fogPng;
          return next;
        }
        const next = { ...v, overlayPng: nextPng };
        delete next.fogPng;
        return next;
      });
      const nextState = { ...base, mapViews };
      return {
        mapViews,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'add-map': {
      const base = normalizeMapState(state);
      const requestedId = typeof op.mapId === 'string' && op.mapId.trim() ? op.mapId.trim() : null;
      const id = requestedId && !base.maps.some((m) => m.id === requestedId) ? requestedId : newMapId();
      const name =
        op.name && String(op.name).trim()
          ? String(op.name).trim()
          : `Map ${base.maps.length + 1}`;
      const credit = normalizeMapArtistFields(op.artist, op.artistUrl);
      const newMap = {
        id,
        name,
        mapImageUrl: op.mapImageUrl ?? null,
        mapDimension: op.mapDimension ?? 'width',
        mapSizeFt: op.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
        mapImageNaturalWidth: op.mapImageNaturalWidth ?? null,
        mapImageNaturalHeight: op.mapImageNaturalHeight ?? null,
        mapAiImagePrompt: op.mapAiImagePrompt ?? null,
        shareWithPlayers: op.shareWithPlayers !== undefined ? !!op.shareWithPlayers : true,
        artist: credit.artist,
        artistUrl: credit.artistUrl,
        libraryMapId: op.libraryMapId ?? null,
        librarySyncImage: op.librarySyncImage !== false,
      };
      if (op.overlayPng != null) newMap.overlayPng = op.overlayPng;
      const libraryViews = Array.isArray(op.mapViews) ? op.mapViews.filter(Boolean) : [];
      let mapViews = [...base.mapViews];
      let firstViewId;
      if (libraryViews.length) {
        const remapped = libraryViews.map((v) => ({
          ...v,
          id: v.id || newViewId(),
          mapId: id,
        }));
        mapViews = [...mapViews, ...remapped];
        firstViewId = remapped[0].id;
      } else {
        const newView = {
          id: newViewId(),
          mapId: id,
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          mapViewVisibleNorm: null,
          broadcastToPlayers: false,
        };
        mapViews = [...mapViews, newView];
        firstViewId = newView.id;
        const extras = op.extraCameraVisibleNorms;
        if (Array.isArray(extras) && extras.length > 0) {
          for (let i = 0; i < extras.length; i++) {
            const vn = extras[i];
            if (!vn || typeof vn !== 'object') continue;
            const nx = Number(vn.x);
            const ny = Number(vn.y);
            const nw = Number(vn.w);
            const nh = Number(vn.h);
            if (![nx, ny, nw, nh].every(Number.isFinite)) continue;
            mapViews = [
              ...mapViews,
              {
                id: newViewId(),
                mapId: id,
                name: `Camera ${i + 2}`,
                mapViewZoomRatio: null,
                mapViewPanNorm: null,
                mapViewVisibleNorm: {
                  x: Math.max(0, Math.min(1, nx)),
                  y: Math.max(0, Math.min(1, ny)),
                  w: Math.max(0, Math.min(1, nw)),
                  h: Math.max(0, Math.min(1, nh)),
                },
                broadcastToPlayers: false,
              },
            ];
          }
        }
      }
      const maps = [...base.maps, newMap];
      let nextEls = activeElements;
      if (Array.isArray(op.dressingElements) && op.dressingElements.length) {
        nextEls = [
          ...activeElements,
          ...op.dressingElements.map((el) => ({ ...el, mapId: el.mapId ?? id })),
        ];
      }
      const nextState = { ...base, maps, mapViews, activeMapId: id, gmActiveViewId: firstViewId };
      syncGmMapViewFromActiveView(nextState);
      return {
        maps,
        mapViews,
        activeMapId: id,
        gmActiveViewId: firstViewId,
        gmMapView: nextState.gmMapView,
        mapConfig: deriveMapConfigFromState(nextState),
        ...(nextEls !== activeElements ? { activeElements: nextEls } : {}),
      };
    }
    case 'sync-library-map': {
      const base = normalizeMapState(state);
      const libId = op.libraryMapId;
      const libraryItem = op.libraryItem;
      if (!libId || !libraryItem) return {};
      const { maps, changed } = syncLibraryMapOntoTableMaps(base.maps, { ...libraryItem, id: libId });
      if (!changed) return {};
      const nextState = { ...base, maps };
      syncGmMapViewFromActiveView(nextState);
      return { maps, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'link-maps-library': {
      const base = normalizeMapState(state);
      const links = Array.isArray(op.links) ? op.links : [];
      const byId = new Map(links.map((l) => [l.mapId, l.libraryMapId]));
      let changed = false;
      const maps = base.maps.map((m) => {
        const libId = byId.get(m.id);
        if (!libId || m.libraryMapId === libId) return m;
        changed = true;
        return { ...m, libraryMapId: libId, librarySyncImage: m.librarySyncImage !== false };
      });
      if (!changed) return {};
      const nextState = { ...base, maps };
      return { maps, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'remove-map': {
      const base = normalizeMapState(state);
      const targetId = op.mapId;
      if (!targetId || base.maps.length <= 1) return {};
      if (!base.maps.some(m => m.id === targetId)) return {};
      const maps = base.maps.filter(m => m.id !== targetId);
      const mapViews = base.mapViews.filter(v => v.mapId !== targetId);
      let activeMapId = base.activeMapId;
      let gmActiveViewId = base.gmActiveViewId;
      if (activeMapId === targetId) {
        activeMapId = maps[0].id;
        gmActiveViewId = mapViews.find(v => v.mapId === activeMapId)?.id ?? mapViews[0]?.id;
      } else if (!mapViews.some(v => v.id === gmActiveViewId)) {
        gmActiveViewId = mapViews.find(v => v.mapId === activeMapId)?.id ?? mapViews[0]?.id;
      }
      const nextEls = activeElements.map(el => {
        if (el.tokenX == null || el.tokenY == null) return el;
        const mid = el.mapId ?? DEFAULT_LEGACY_MAP_ID;
        if (mid !== targetId) return el;
        return { ...el, tokenX: null, tokenY: null, mapId: null, altitude: 0 };
      });
      const nextState = { ...base, maps, mapViews, activeMapId, gmActiveViewId };
      syncGmMapViewFromActiveView(nextState);
      return {
        maps,
        mapViews,
        activeMapId,
        gmActiveViewId,
        gmMapView: nextState.gmMapView,
        activeElements: nextEls,
        mapConfig: deriveMapConfigFromState(nextState),
      };
    }
    case 'rename-map': {
      const base = normalizeMapState(state);
      const targetId = op.mapId;
      const name = op.name != null ? String(op.name).trim() : '';
      if (!targetId || !name) return {};
      const maps = base.maps.map(m => {
        if (m.id !== targetId) return m;
        const next = { ...m, name };
        if ('artist' in op || 'artistUrl' in op) {
          const credit = normalizeMapArtistFields(op.artist, op.artistUrl);
          next.artist = credit.artist;
          next.artistUrl = credit.artistUrl;
        }
        return next;
      });
      const nextState = { ...base, maps };
      return { maps, mapConfig: deriveMapConfigFromState(nextState) };
    }
    case 'set-gm-display-name':
      return { gmDisplayName: op.gmDisplayName };
    case 'set-table-feature-state':
      return { featureState: op.featureState ?? {} };
    case 'set-table-name':
      return { tableName: op.tableName ?? '' };
    case 'set-table-public':
      return { isPublic: op.isPublic === true };
    case 'life-support-select': {
      const prev = state.lifeSupportSelections || {};
      const key = String(op._rollDbId);
      const value = op.selectedLifeSupportTargetInstanceId;
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return { lifeSupportSelections: next };
    }
    case 'life-support-clear': {
      const prev = state.lifeSupportSelections || {};
      const next = { ...prev };
      delete next[String(op._rollDbId)];
      return { lifeSupportSelections: next };
    }
    case 'rest-move-select': {
      const prev = state.restMovesSelections || {};
      const key = String(op.rollDbId);
      const perRoll = prev[key] ? { ...prev[key] } : {};
      const perChar = perRoll[op.instanceId] ? { ...perRoll[op.instanceId] } : {};
      perChar['move' + op.slot] = op.moveId ?? null;
      if (op.targetInstanceId !== undefined) perChar['move' + op.slot + 'TargetInstanceId'] = op.targetInstanceId ?? null;
      if (op.rollResult !== undefined) perChar['move' + op.slot + 'RollResult'] = op.rollResult ?? null;
      perRoll[op.instanceId] = perChar;
      const next = { ...prev, [key]: perRoll };
      return { restMovesSelections: next };
    }
    case 'rest-move-clear': {
      const prev = state.restMovesSelections || {};
      const next = { ...prev };
      delete next[String(op._rollDbId)];
      return { restMovesSelections: next };
    }
    case 'set-table-top':
      return {
        top: {
          ...(state.top || {}),
          ...(op.top || {}),
        },
      };
    case 'touch-session-activity':
      return {
        top: {
          ...(state.top || {}),
          lastPlayActivityAt: Date.now(),
        },
      };
    default:
      return {};
  }
}

/**
 * Apply V2 engine mutations that target **`element.activeModifiers`** (Phase 1 shape) in order.
 * Ignores other mutation types (Hope/Stress, rolls, etc.) — those are handled by the VTT separately.
 *
 * @param {object[]} activeElements — current table elements
 * @param {object[]} mutations — `{ type, payload }[]` from `applyMutations(table)` (V2)
 * @returns {object[]} — new **`activeElements`** array (copied elements; only character rows touched)
 */
export function applyV2ActiveModifierMutations(activeElements, mutations) {
  if (!Array.isArray(activeElements) || !Array.isArray(mutations) || mutations.length === 0) {
    return activeElements;
  }
  const idxByInstance = new Map(activeElements.map((el, i) => [el.instanceId, i]));
  const out = activeElements.map(el => ({ ...el }));

  for (const m of mutations) {
    if (!m?.type || !m?.payload) continue;
    const { type, payload } = m;
    if (type === 'appendActiveModifier') {
      const { instanceId, modifier } = payload;
      if (!instanceId || !modifier?.id || !modifier?.name) continue;
      const i = idxByInstance.get(instanceId);
      if (i === undefined || out[i].elementType !== 'character') continue;
      const el = out[i];
      const cur = [...(el.activeModifiers || [])];
      const ix = cur.findIndex(x => x.id === modifier.id);
      if (ix >= 0) cur[ix] = { ...modifier };
      else cur.push({ ...modifier });
      out[i] = { ...el, activeModifiers: cur };
    } else if (type === 'removeActiveModifier') {
      const { instanceId, id } = payload;
      if (!instanceId || id == null) continue;
      const i = idxByInstance.get(instanceId);
      if (i === undefined || out[i].elementType !== 'character') continue;
      const el = out[i];
      const rid = String(id);
      const next = (el.activeModifiers || []).filter(x => x.id !== rid);
      if (next.length === (el.activeModifiers || []).length) continue;
      out[i] = { ...el, activeModifiers: next };
    }
  }
  return out;
}

/**
 * Effective magnitude of a single banner mutation on `el` (pre-merge snapshot), matching
 * {@link applyV2BannerMutations}. Used for summaries when requested amounts exceed caps (e.g. clear
 * 2 Stress but only 1 marked). Returns 0 if skipped or non-numeric.
 *
 * @param {string} type
 * @param {object} payload
 * @param {object} el — merged element from getBase (character or adversary; Hope/Gold/armor still character-only in apply)
 * @returns {number}
 */
export function effectiveBannerMutationDelta(type, payload, el) {
  if (!el || typeof payload !== 'object') return 0;
  switch (type) {
    case 'spendHope': {
      if (el.elementType !== 'character') return 0;
      const max = el.maxHope ?? 6;
      const hope = el.hope ?? max;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newHope = Math.max(0, hope - n);
      return hope - newHope;
    }
    case 'gainHope': {
      if (el.elementType !== 'character') return 0;
      const max = el.maxHope ?? 6;
      const hope = el.hope ?? max;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newHope = Math.min(max, hope + n);
      return newHope - hope;
    }
    case 'markStress': {
      const maxS = el.maxStress ?? 6;
      const cur = el.currentStress ?? 0;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newS = Math.min(maxS, cur + n);
      return newS - cur;
    }
    case 'clearStress': {
      const cur = el.currentStress ?? 0;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newS = Math.max(0, cur - n);
      return cur - newS;
    }
    case 'markHP': {
      const maxH = el.maxHp ?? 6;
      const curHp = el.currentHp ?? maxH;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newHp = Math.max(0, Math.min(maxH, curHp - n));
      return curHp - newHp;
    }
    case 'clearHP': {
      const maxH = el.maxHp ?? 6;
      const curHp = el.currentHp ?? maxH;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newHp = Math.min(maxH, curHp + n);
      return newHp - curHp;
    }
    case 'markArmor': {
      if (el.elementType !== 'character') return 0;
      const maxA = el.maxArmor ?? 0;
      const cur = el.currentArmor ?? 0;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newA = Math.min(maxA, cur + n);
      return newA - cur;
    }
    case 'clearArmor': {
      if (el.elementType !== 'character') return 0;
      const cur = el.currentArmor ?? 0;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newA = Math.max(0, cur - n);
      return cur - newA;
    }
    case 'spendGold': {
      if (el.elementType !== 'character') return 0;
      const gold = el.gold ?? 0;
      const n = Math.max(0, Math.floor(Number(payload.amount)) || 0);
      const newG = Math.max(0, gold - n);
      return gold - newG;
    }
    default:
      return 0;
  }
}

/**
 * Walks the same ordered merge as {@link applyV2BannerMutations} and sums **applied** numeric
 * deltas for characters other than `ownerInstanceId` (Hope, Stress, HP, Armor, Gold).
 *
 * @param {object[]} activeElements
 * @param {object[]} mutations
 * @param {string} [ownerInstanceId]
 * @returns {Map<string, number>} keys `${canonicalInstanceId}\0${mutationType}` → summed effective amount
 */
export function accumulateOtherPartyEffectiveNumericDeltas(activeElements, mutations, ownerInstanceId) {
  const out = new Map();
  runV2BannerMutationLoop(mutations, activeElements, ownerInstanceId, (canon, type, delta) => {
    const k = `${canon}\0${type}`;
    out.set(k, (out.get(k) || 0) + delta);
  });
  return out;
}

/**
 * @param {object[]} mutations
 * @param {object[]} activeElements
 * @param {string|undefined} ownerInstanceId
 * @param {((canon: string, type: string, delta: number) => void) | null} onOtherPartyNumericDelta
 * @returns {{ skipped: object[], byId: Map<string, object>, modMuts: object[] }}
 */
function runV2BannerMutationLoop(mutations, activeElements, ownerInstanceId, onOtherPartyNumericDelta) {
  const skipped = [];
  const byId = new Map();

  function resolveCanonicalInstanceId(id) {
    if (id == null || id === '') return null;
    const s = String(id);
    const match = activeElements.find(
      (e) =>
        e &&
        (e.instanceId === id ||
          e.id === id ||
          String(e.instanceId) === s ||
          String(e.id) === s)
    );
    return match ? (match.instanceId ?? match.id) : null;
  }

  const ownerCanon = ownerInstanceId != null ? resolveCanonicalInstanceId(ownerInstanceId) : null;

  const getBase = (id) => {
    const key = resolveCanonicalInstanceId(id);
    if (key == null) return undefined;
    const patch = byId.get(key);
    const base = activeElements.find((e) => (e.instanceId ?? e.id) === key);
    return patch ? { ...base, ...patch } : base && { ...base };
  };

  const merge = (instanceId, partial) => {
    const key = resolveCanonicalInstanceId(instanceId);
    if (key == null) return;
    const prev = byId.get(key) || {};
    byId.set(key, { ...prev, ...partial });
  };

  const modMuts = [];

  for (const m of mutations || []) {
    if (!m?.type || !m?.payload) continue;
    const { type, payload } = m;

    const skip = () => skipped.push(m);

    if (type === 'appendActiveModifier' || type === 'removeActiveModifier') {
      modMuts.push(m);
      continue;
    }

    const maybeHookNumeric = (mutationType, instanceId, el, payloadObj) => {
      if (!onOtherPartyNumericDelta || !el || el.elementType !== 'character') return;
      const canon = resolveCanonicalInstanceId(instanceId);
      if (!canon || !ownerCanon || canon === ownerCanon) return;
      const d = effectiveBannerMutationDelta(mutationType, payloadObj, el);
      if (d > 0) onOtherPartyNumericDelta(canon, mutationType, d);
    };

    switch (type) {
      case 'setFeatureState': {
        const { featureKey, key, value, instanceId: payloadInstanceId, manual, cardValue } = payload;
        // Prefer outer owner (banner / chip activation) when set; else payload.instanceId from
        // engine `table.feature.set` (e.g. lifecycle hooks when applyV2LifecycleMutations has no owner).
        const targetOwner =
          ownerInstanceId != null && ownerInstanceId !== '' ? ownerInstanceId : payloadInstanceId;
        if (!targetOwner || !featureKey) {
          skip();
          break;
        }
        const el = getBase(targetOwner);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const fs = { ...(el.featureState || {}) };
        const bag = { ...(fs[featureKey] || {}) };
        bag[key] = value;
        const nextCv = { ...(bag._cardValues || {}) };
        if (cardValue !== undefined) {
          if (cardValue === null || cardValue === '') {
            delete nextCv[key];
          } else {
            nextCv[key] = String(cardValue);
          }
        } else if (value == null) {
          delete nextCv[key];
        }
        if (Object.keys(nextCv).length === 0) {
          delete bag._cardValues;
        } else {
          bag._cardValues = nextCv;
        }
        if (featureKey === SRD_CLASS_DRUID_SCOPE_KEY && key === 'activeBeastform' && value == null) {
          bag.evolutionTraitKey = null;
        }
        fs[featureKey] = bag;
        const mergePatch = { featureState: fs };
        if (manual === true) {
          const fd = { ...(el.featureStateDeclared || {}) };
          const declBag = { ...(fd[featureKey] || {}) };
          declBag[key] = true;
          fd[featureKey] = declBag;
          mergePatch.featureStateDeclared = fd;
        }
        merge(targetOwner, mergePatch);
        if (featureKey === SRD_CLASS_DRUID_SCOPE_KEY && key === 'activeBeastform' && value == null) {
          merge(targetOwner, { activeBeastform: null, selectedBeastformAdvantage: null });
        }
        break;
      }
      case 'spendHope': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        maybeHookNumeric('spendHope', instanceId, el, payload);
        const max = el.maxHope ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const hope = Math.max(0, (el.hope ?? max) - n);
        merge(instanceId, { hope });
        break;
      }
      case 'gainHope': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        maybeHookNumeric('gainHope', instanceId, el, payload);
        const max = el.maxHope ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const hope = Math.min(max, (el.hope ?? max) + n);
        merge(instanceId, { hope });
        break;
      }
      case 'markStress': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        maybeHookNumeric('markStress', instanceId, el, payload);
        const maxS = el.maxStress ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentStress = Math.min(maxS, (el.currentStress ?? 0) + n);
        merge(instanceId, { currentStress });
        break;
      }
      case 'clearStress': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        maybeHookNumeric('clearStress', instanceId, el, payload);
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentStress = Math.max(0, (el.currentStress ?? 0) - n);
        merge(instanceId, { currentStress });
        break;
      }
      case 'markHP': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        maybeHookNumeric('markHP', instanceId, el, payload);
        const maxH = el.maxHp ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentHp = Math.max(0, Math.min(maxH, (el.currentHp ?? maxH) - n));
        merge(instanceId, { currentHp });
        break;
      }
      case 'clearHP': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        maybeHookNumeric('clearHP', instanceId, el, payload);
        const maxH = el.maxHp ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentHp = Math.min(maxH, (el.currentHp ?? maxH) + n);
        merge(instanceId, { currentHp });
        break;
      }
      case 'markArmor': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        maybeHookNumeric('markArmor', instanceId, el, payload);
        const maxA = el.maxArmor ?? 0;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentArmor = Math.min(maxA, (el.currentArmor ?? 0) + n);
        merge(instanceId, { currentArmor });
        break;
      }
      case 'clearArmor': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        maybeHookNumeric('clearArmor', instanceId, el, payload);
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentArmor = Math.max(0, (el.currentArmor ?? 0) - n);
        merge(instanceId, { currentArmor });
        break;
      }
      case 'spendGold': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        maybeHookNumeric('spendGold', instanceId, el, payload);
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const gold = Math.max(0, (el.gold ?? 0) - n);
        merge(instanceId, { gold });
        break;
      }
      case 'setFocusTarget': {
        const { instanceId, focusTargetInstanceId } = payload;
        merge(instanceId, {
          focusTargetInstanceId: focusTargetInstanceId ?? null,
          focusTargetId: focusTargetInstanceId ?? null,
        });
        break;
      }
      case 'setRangerFocusOnNextAttack': {
        const { instanceId, value } = payload;
        merge(instanceId, { rangerFocusOnNextAttack: value === true });
        break;
      }
      case 'setFocusedBy': {
        const { instanceId, focusedBy } = payload;
        merge(instanceId, { focusedBy: focusedBy ?? null });
        break;
      }
      case 'runtimeStatMod': {
        if (payload.stat === 'difficulty') {
          const el = getBase(payload.instanceId);
          if (!el || el.elementType !== 'adversary') {
            skip();
            break;
          }
          const cur = el.difficultyMod ?? 0;
          const next = cur + (Number(payload.delta) || 0);
          merge(payload.instanceId, { difficultyMod: next });
        } else skip();
        break;
      }
      case 'setPrayerDicePool': {
        const { instanceId, pool } = payload;
        merge(instanceId, { prayerDice: { pool: Array.isArray(pool) ? [...pool] : [] } });
        break;
      }
      case 'removePrayerDieAt': {
        const { instanceId, index } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const pool = [...(el.prayerDice?.pool || [])];
        const idx = Math.floor(Number(index));
        if (idx >= 0 && idx < pool.length) pool.splice(idx, 1);
        merge(instanceId, { prayerDice: { pool } });
        break;
      }
      case 'clearFeatureUsageKey': {
        const { instanceId, featureKey } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const k = featureKey != null ? String(featureKey).trim() : '';
        if (!k) {
          skip();
          break;
        }
        const fu = { ...(el.featureUsage || {}) };
        delete fu[k];
        merge(instanceId, { featureUsage: fu });
        break;
      }
      case 'move': {
        const {
          instanceId,
          desiredCondition,
          description,
          rollDbId,
          freezeOtherInstanceId,
          freezeReason,
          rehydrateKey,
        } = payload;
        if (rollDbId == null) {
          skip();
          break;
        }
        const canon = resolveCanonicalInstanceId(instanceId);
        if (canon == null) {
          skip();
          break;
        }
        const dc = String(desiredCondition ?? '').trim();
        const longDesc = String(description ?? '').trim();
        const primary = dc || longDesc;
        const supplementary = dc ? longDesc : '';
        const frozenCanon = freezeOtherInstanceId != null ? resolveCanonicalInstanceId(freezeOtherInstanceId) : null;
        const defaultLock = 'Kick: pending map position';
        const lockReason =
          frozenCanon != null
            ? String(freezeReason || '').trim() || defaultLock
            : null;
        const rk =
          rehydrateKey != null && String(rehydrateKey).trim() !== '' ? String(rehydrateKey).trim() : null;
        merge(canon, {
          v2PendingMove: {
            rollDbId,
            desiredCondition: primary || 'Map position',
            description: supplementary,
            moverInstanceId: canon,
            conditionMet: false,
            ...(rk ? { rehydrateKey: rk } : {}),
            ...(frozenCanon && lockReason
              ? { frozenInstanceId: frozenCanon, frozenLockSource: lockReason }
              : {}),
          },
        });
        if (frozenCanon && lockReason) {
          const fel = getBase(frozenCanon);
          const list = Array.isArray(fel?.moveDisabledSources) ? [...fel.moveDisabledSources] : [];
          if (!list.includes(lockReason)) list.push(lockReason);
          merge(frozenCanon, {
            moveDisabledSources: list,
            v2MoveLockRollDbId: rollDbId,
            v2MoveLockSource: lockReason,
          });
        }
        break;
      }
      case 'restrictMovement': {
        const { instanceId, reason } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        const key = String(reason ?? '').trim() || 'Movement locked';
        const list = Array.isArray(el.moveDisabledSources) ? [...el.moveDisabledSources] : [];
        if (!list.includes(key)) list.push(key);
        merge(instanceId, { moveDisabledSources: list });
        break;
      }
      case 'allowMovement': {
        const { instanceId, reason } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        const key = reason != null && String(reason).trim() !== '' ? String(reason).trim() : null;
        const list = Array.isArray(el.moveDisabledSources) ? [...el.moveDisabledSources] : [];
        if (key) {
          merge(instanceId, { moveDisabledSources: list.filter((s) => s !== key) });
        } else {
          skip();
        }
        break;
      }
      case 'inventoryRemove': {
        const { instanceId, itemName } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const inv = Array.isArray(el.inventory) ? [...el.inventory] : [];
        const needle = String(itemName || '').trim();
        if (!needle) {
          skip();
          break;
        }
        const idx = inv.findIndex(
          (it) =>
            it &&
            typeof it === 'object' &&
            (it.name === needle || it.id === needle || String(it.name || '').trim() === needle)
        );
        if (idx < 0) {
          skip();
          break;
        }
        inv.splice(idx, 1);
        merge(instanceId, { inventory: inv });
        break;
      }
      case 'inventoryAdd': {
        const { instanceId, item } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character' || !item || typeof item !== 'object') {
          skip();
          break;
        }
        const inv = Array.isArray(el.inventory) ? [...el.inventory, item] : [item];
        merge(instanceId, { inventory: inv });
        break;
      }
      case 'addCondition': {
        const { instanceId, condition } = payload;
        const el = getBase(instanceId);
        if (!el || condition == null || String(condition).trim() === '') {
          skip();
          break;
        }
        const list = normalizeConditionsToList(el.conditions);
        const name = String(condition).trim();
        if (!list.includes(name)) list.push(name);
        merge(instanceId, { conditions: serializeConditionsList(list) });
        break;
      }
      case 'removeCondition': {
        const { instanceId, condition } = payload;
        const el = getBase(instanceId);
        if (!el || condition == null || String(condition).trim() === '') {
          skip();
          break;
        }
        const name = String(condition).trim();
        const next = normalizeConditionsToList(el.conditions).filter((c) => c !== name);
        merge(instanceId, { conditions: serializeConditionsList(next) });
        break;
      }
      default:
        skip();
    }
  }

  return { skipped, byId, modMuts };
}

/**
 * Apply V2 engine mutations from a banner chip (`activateChip` / `deductChipCosts`) to character
 * (and adversary) rows. Mutations that need server-side dice rolls or banner patches are not applied
 * and are returned in `skipped`.
 *
 * @param {object[]} activeElements — current table elements (read-only basis; caller merges)
 * @param {object[]} mutations — `{ type, payload }[]`
 * @param {string} ownerInstanceId — feature owner (`chip._ownerInstanceId`) for `setFeatureState` rows
 * @returns {{ updates: { instanceId: string, updates: object }[], skipped: object[] }}
 */
export function applyV2BannerMutations(activeElements, mutations, ownerInstanceId) {
  const { skipped, byId, modMuts } = runV2BannerMutationLoop(mutations, activeElements, ownerInstanceId, null);

  let mergedEls = activeElements.map((el) => {
    const key = el.instanceId ?? el.id;
    const u = key != null ? byId.get(key) : undefined;
    return u ? { ...el, ...u } : { ...el };
  });
  if (modMuts.length > 0) {
    mergedEls = applyV2ActiveModifierMutations(mergedEls, modMuts);
  }

  const updates = [];
  for (const el of mergedEls) {
    const rowKey = el.instanceId ?? el.id;
    const orig = activeElements.find((e) => (e.instanceId ?? e.id) === rowKey);
    if (!orig) continue;
    const partial = {};
    for (const k of Object.keys(el)) {
      if (el[k] !== orig[k]) partial[k] = el[k];
    }
    if (Object.keys(partial).length > 0) {
      updates.push({ instanceId: rowKey, updates: partial });
    }
  }

  return { updates, skipped };
}

/**
 * Mutations that adjust hydrated roll shape only (no `activeElements` patch). The Game Table does not
 * yet persist these onto the pending banner — they are omitted from {@link applyV2BannerMutations} so
 * they do not appear in `skipped` / console warnings.
 * (`addRollDie` / `addRollStatic` action+damage keys are handled in {@link partitionV2BannerChipMutations}.)
 */
const V2_ENGINE_ROLL_DISPLAY_MUTATION_TYPES = new Set([
  'setDie',
  'setRollOutcome',
  'setActionRollSuccess',
  'setActionRollCritical',
  'swapHopeFearDice',
  'addAdvantageDie',
  'addDisadvantageDie',
  'removeAdvantageDie',
  'removeDisadvantageDie',
  'removeRollDie',
  'addNarration',
]);

/**
 * Merge adjacent Hope + Fear `rerollDie` mutations (e.g. Faerie **Luckbender** calling both
 * `hopeDie.reroll()` and `fearDie.reroll()`) into one server round-trip via `dieType: 'Duality'`.
 *
 * @param {object[]} mutations
 * @returns {object[]}
 */
export function normalizeV2BannerChipMutations(mutations) {
  if (!Array.isArray(mutations) || mutations.length === 0) return mutations || [];
  const out = [];
  for (let i = 0; i < mutations.length; i++) {
    const a = mutations[i];
    const b = mutations[i + 1];
    if (
      a?.type === 'rerollDie' &&
      b?.type === 'rerollDie'
    ) {
      const dt1 = a.payload?.dieType;
      const dt2 = b.payload?.dieType;
      if (
        (dt1 === 'hopeDie' && dt2 === 'fearDie') ||
        (dt1 === 'fearDie' && dt2 === 'hopeDie')
      ) {
        out.push({
          type: 'rerollDie',
          payload: { dieType: 'dualityDie', _mergedFrom: [a, b] },
        });
        i++;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

/**
 * Split V2 `activateChip` / `applyMutations` output into:
 * - **localMutations** — applied by {@link applyV2BannerMutations} (Hope/Stress, featureState, …)
 * - **serverFollowups** — must use `postBannerAddDamage` / `postBannerRerollDie` / `postBannerActionAddDie` / `postBannerActionAddStatic` (banner updates);
 *   damage-pool **`addRollDie`** (e.g. Sneak Attack) is folded into **`addDamage`** follow-ups;
 *   action-pool **`addRollDie`** (e.g. Heart of a Poet d4) is **`patchActionRollAddDie`** (in-place pending banner patch; Hope already applied via local mutations);
 *   **`addRollStatic`** with `rollKey === 'action'` (e.g. Seraph Prayer Die face) is **`patchActionRollAddStatic`**; with `rollKey === 'damage'` it reuses **`addDamage`** with a constant dice expression
 * - **engineRollDisplayOnly** — roll-shape / narration mutations not persisted on the VTT yet (not an error)
 * - **unsupported** — not representable on the current Game Table APIs (logged for diagnostics)
 *
 * @param {object[]} mutations — `{ type, payload }[]`
 * @returns {{
 *   localMutations: object[],
 *   serverFollowups: object[],
 *   engineRollDisplayOnly: object[],
 *   unsupported: object[]
 * }}
 */
export function partitionV2BannerChipMutations(mutations) {
  const localMutations = [];
  const serverFollowups = [];
  const engineRollDisplayOnly = [];
  const unsupported = [];
  const normalized = normalizeV2BannerChipMutations(mutations || []);

  for (const m of normalized) {
    if (!m?.type) continue;
    const { type, payload } = m;
    /** Damage dice added on the current banner (e.g. Rogue Sneak Attack) — persist via `postBannerAddDamage`. */
    if (type === 'addRollDie' && payload?.rollKey === 'damage') {
      const dice = String(payload.die ?? '').trim();
      if (dice) {
        serverFollowups.push({
          kind: 'addDamage',
          payload: { dice, name: payload.name },
          mutation: m,
        });
      }
      continue;
    }
    /** Action pool bonus dice (e.g. Wordsmith Heart of a Poet) — persist via `postBannerActionAddDie` (no server Hope spend). */
    if (type === 'addRollDie' && payload?.rollKey === 'action') {
      const die = String(payload.die ?? '').trim();
      if (die) {
        serverFollowups.push({
          kind: 'patchActionRollAddDie',
          payload: { die, name: payload.name },
          mutation: m,
        });
      }
      continue;
    }
    if (type === 'addRollDie') {
      engineRollDisplayOnly.push(m);
      continue;
    }
    /** Static action bonus (e.g. Seraph Prayer Die face value) — persist via `postBannerActionAddStatic`. */
    if (type === 'addRollStatic' && payload?.rollKey === 'action') {
      const v = Number(payload?.value);
      if (Number.isFinite(v)) {
        serverFollowups.push({
          kind: 'patchActionRollAddStatic',
          payload: { value: v, name: payload.name },
          mutation: m,
        });
      } else {
        engineRollDisplayOnly.push(m);
      }
      continue;
    }
    /** Static damage bonus (Prayer Die to damage) — `postBannerAddDamage` with constant extra damage. */
    if (type === 'addRollStatic' && payload?.rollKey === 'damage') {
      const v = Number(payload?.value);
      if (Number.isFinite(v)) {
        serverFollowups.push({
          kind: 'addDamage',
          payload: { dice: String(v), name: payload.name },
          mutation: m,
        });
      } else {
        engineRollDisplayOnly.push(m);
      }
      continue;
    }
    if (type === 'addRollStatic') {
      engineRollDisplayOnly.push(m);
      continue;
    }
    if (V2_ENGINE_ROLL_DISPLAY_MUTATION_TYPES.has(type)) {
      engineRollDisplayOnly.push(m);
      continue;
    }
    if (type === 'rerollDie') {
      const dt = payload?.dieType;
      if (dt === 'hopeDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Hope', mutation: m });
        continue;
      }
      if (dt === 'fearDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Fear', mutation: m });
        continue;
      }
      if (dt === 'dualityDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Duality', mutation: m });
        continue;
      }
      unsupported.push(m);
      continue;
    }
    if (type === 'addDamageRoll') {
      serverFollowups.push({ kind: 'addDamage', payload, mutation: m });
      continue;
    }
    /** `move()` from V2 chips — interim: action banner only (no v2PendingMove / map lock). */
    if (type === 'move') {
      serverFollowups.push({
        kind: 'forcedMovementNotice',
        payload: payload && typeof payload === 'object' ? { ...payload } : {},
        mutation: m,
      });
      continue;
    }
    localMutations.push(m);
  }
  return { localMutations, serverFollowups, engineRollDisplayOnly, unsupported };
}

function mergeElementUpdatesByInstance(listA, listB) {
  const m = new Map();
  for (const { instanceId, updates } of [...listA, ...listB]) {
    if (!instanceId || !updates) continue;
    m.set(instanceId, { ...(m.get(instanceId) || {}), ...updates });
  }
  return [...m.entries()].map(([instanceId, updates]) => ({ instanceId, updates }));
}

function resolveConditionMutationElementIndex(working, instanceId) {
  if (instanceId == null || instanceId === '') return null;
  const s = String(instanceId);
  const i = working.findIndex(
    (e) =>
      e &&
      (e.instanceId === instanceId ||
        e.id === instanceId ||
        String(e.instanceId) === s ||
        String(e.id) === s)
  );
  return i >= 0 ? i : null;
}

function applyV2ConditionMutations(activeElements, mutations) {
  let working = activeElements.map((e) => ({ ...e }));
  for (const m of mutations) {
    if (m.type === 'removeCondition') {
      const i = resolveConditionMutationElementIndex(working, m.payload.instanceId);
      if (i == null) continue;
      const el = working[i];
      const next = normalizeConditionsToList(el.conditions).filter((c) => c !== m.payload.condition);
      working[i] = {
        ...el,
        conditions: serializeConditionsList(next),
      };
    } else if (m.type === 'addCondition') {
      const i = resolveConditionMutationElementIndex(working, m.payload.instanceId);
      if (i == null) continue;
      const el = working[i];
      const c = normalizeConditionsToList(el.conditions);
      if (!c.includes(m.payload.condition)) c.push(m.payload.condition);
      working[i] = { ...el, conditions: serializeConditionsList(c) };
    }
  }
  return working;
}

function diffElements(from, to) {
  const updates = [];
  for (const el of to) {
    const orig = from.find((e) => e.instanceId === el.instanceId);
    if (!orig) continue;
    const partial = {};
    for (const k of Object.keys(el)) {
      if (el[k] !== orig[k]) partial[k] = el[k];
    }
    if (Object.keys(partial).length > 0) {
      updates.push({ instanceId: el.instanceId, updates: partial });
    }
  }
  return updates;
}

/**
 * Human-readable line for a V2 engine `rollDie` mutation (e.g. Bard Rally spend, in-engine rolls).
 * @param {{ type?: string, payload?: { notation?: string, results?: number[], total?: number } }} m
 * @returns {string}
 */
export function formatV2RollDieMutationLine(m) {
  if (m?.type !== 'rollDie' || !m?.payload) return '';
  const { notation, results, total } = m.payload;
  const n = String(notation || 'd6').trim();
  const r = Array.isArray(results) ? results : [];
  const t = total != null ? Number(total) : r.length ? r.reduce((a, b) => a + b, 0) : NaN;
  if (Number.isNaN(t)) return '';
  if (r.length <= 1) {
    return `Rolled ${n}: **${t}**`;
  }
  return `Rolled ${n}: ${r.join(' + ')} = **${t}**`;
}

/**
 * Apply V2 engine mutations from token-move hooks (`dispatchTokenMoveHooks`) and cross-sheet
 * chip activation: conditions, `actionLoop` notifications, and banner-shaped rows.
 *
 * @param {object[]} activeElements
 * @param {object[]} mutations
 * @param {string|undefined} setFeatureStateOwnerId — `chip._ownerInstanceId` for `setFeatureState` rows (e.g. Bard for Rally); omit when none
 * @returns {{ updates: { instanceId: string, updates: object }[], actionLoopNotifications: object[], skipped: object[], sheetActionRolls: { rollText: string, displayName: string, rollMeta: object }[] }}
 */
export function applyV2LifecycleMutations(activeElements, mutations, setFeatureStateOwnerId) {
  /** @type {{ rollText: string, displayName: string, rollMeta: object }[]} */
  const sheetActionRolls = [];
  const mutationsForLifecycle = [];
  for (const m of mutations || []) {
    if (!m?.type) continue;
    if (m.type === 'sheetActionRoll') {
      const p = m.payload;
      if (p && typeof p === 'object' && typeof p.rollText === 'string' && p.rollText.trim()) {
        sheetActionRolls.push({
          rollText: p.rollText.trim(),
          displayName: p.displayName != null ? String(p.displayName) : '',
          rollMeta: p.rollMeta && typeof p.rollMeta === 'object' ? p.rollMeta : {},
        });
      }
      continue;
    }
    mutationsForLifecycle.push(m);
  }

  const rollDieLines = [];
  /** @type {{ notation?: string, results?: number[], total?: number }[]} */
  const rollDiePayloads = [];
  const mutationsSansRollDie = [];
  for (const m of mutationsForLifecycle) {
    if (!m?.type) continue;
    if (m.type === 'rollDie') {
      const line = formatV2RollDieMutationLine(m);
      if (line) rollDieLines.push(line);
      if (m.payload && typeof m.payload === 'object') {
        rollDiePayloads.push({
          notation: m.payload.notation,
          results: Array.isArray(m.payload.results) ? m.payload.results : [],
          total: m.payload.total,
        });
      }
      continue;
    }
    mutationsSansRollDie.push(m);
  }
  const rollDieBlock = rollDieLines.join('\n');

  const actionLoopNotifications = [];
  const conditionMuts = [];
  const bannerMuts = [];
  for (const m of mutationsSansRollDie) {
    if (m.type === 'actionLoop') {
      if (m.payload && typeof m.payload === 'object') {
        const base = { ...m.payload };
        if (rollDieBlock) {
          base.description = [rollDieBlock, m.payload.description || ''].filter(Boolean).join('\n\n');
        }
        if (rollDiePayloads.length > 0) {
          base._v2RollDiePayloads = rollDiePayloads;
        }
        actionLoopNotifications.push(base);
      } else {
        actionLoopNotifications.push(m.payload);
      }
    } else if (m.type === 'removeCondition' || m.type === 'addCondition') {
      conditionMuts.push(m);
    } else {
      bannerMuts.push(m);
    }
  }

  const afterConditions = applyV2ConditionMutations(activeElements, conditionMuts);
  const conditionUpdates = diffElements(activeElements, afterConditions);

  const { updates: bannerUpdates, skipped } = applyV2BannerMutations(
    afterConditions,
    bannerMuts,
    setFeatureStateOwnerId
  );

  if (rollDieBlock && actionLoopNotifications.length === 0) {
    const stressMut = mutationsSansRollDie.find((m) => m.type === 'clearStress');
    const iid = stressMut?.payload?.instanceId;
    const el = iid ? activeElements.find((e) => (e.instanceId ?? e.id) === iid) : null;
    actionLoopNotifications.push({
      instanceId: iid,
      title: 'Dice roll',
      description: rollDieBlock,
      rollUser: el?.name || 'Character',
      ...(rollDiePayloads.length > 0 ? { _v2RollDiePayloads: rollDiePayloads } : {}),
    });
  }

  const updates = mergeElementUpdatesByInstance(conditionUpdates, bannerUpdates);
  return { updates, actionLoopNotifications, skipped, sheetActionRolls };
}

