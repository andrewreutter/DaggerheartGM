/**
 * Local table-ops adapter for the Scene editor.
 *
 * Scene library rows use the same field names as `table_state` (`activeElements`,
 * `maps`, `mapViews`, `activeMapId`, `gmActiveViewId`, `sessionCountdowns`,
 * `tableBattleMods`). Mutations construct the same op objects used by
 * `postTableOp` and apply them with the existing pure `applyTableOp` — no
 * network table ops, no new op types.
 *
 * BattleMap is rendered with `tableId` omitted so ping/scribble/banner-ack
 * no-op. Map-art / overlay / placed-image uploads still hit Storage; only the
 * resulting URL is written into the scene via `applyTableOp`.
 *
 * Callbacks are referentially stable (they close over a `setSceneData` wrapper
 * that must itself be stable or ref-backed) so BattleMap's `onMapViewSync`
 * effect does not loop.
 */

import { applyTableOp } from './table-ops.js';
import { attachDerivedMapConfig, deriveMapConfigFromState } from './map-table-state.js';
import { dataUrlToFile, loadImageNaturalSizeFromUrl } from './map-image-data-url.js';
import { generateId } from './helpers.js';

export const DEFAULT_SCENE_BATTLE_MODS = {
  lessDifficult: false,
  slightlyMoreDangerous: false,
  damageBoostPlusOne: false,
  damageBoostD4: false,
  damageBoostStatic: false,
  moreDangerous: false,
};

/**
 * Empty scene table slice with one default map (via `attachDerivedMapConfig`).
 * @returns {object}
 */
export function emptySceneTableSlice() {
  return attachDerivedMapConfig({
    maps: [],
    mapViews: [],
    activeMapId: null,
    gmActiveViewId: null,
    gmMapView: null,
    activeElements: [],
    sessionCountdowns: [],
    tableBattleMods: { ...DEFAULT_SCENE_BATTLE_MODS },
    conditionsHistory: [],
    featureCountdowns: {},
  });
}

/**
 * Fill missing table-shaped fields so BattleMap / applyTableOp have a valid state.
 * @param {object} [sceneData]
 * @returns {object}
 */
export function normalizeSceneTableData(sceneData) {
  const empty = emptySceneTableSlice();
  const merged = {
    ...empty,
    ...(sceneData && typeof sceneData === 'object' ? sceneData : {}),
    activeElements: Array.isArray(sceneData?.activeElements) ? sceneData.activeElements : [],
    sessionCountdowns: Array.isArray(sceneData?.sessionCountdowns) ? sceneData.sessionCountdowns : [],
    tableBattleMods: { ...DEFAULT_SCENE_BATTLE_MODS, ...(sceneData?.tableBattleMods || {}) },
    conditionsHistory: Array.isArray(sceneData?.conditionsHistory) ? sceneData.conditionsHistory : [],
  };
  return attachDerivedMapConfig(merged);
}

/**
 * Apply one table op locally and return the merged scene data.
 * @param {object} sceneData
 * @param {object} op
 * @returns {object}
 */
export function applySceneTableOp(sceneData, op) {
  const prev = normalizeSceneTableData(sceneData);
  const patch = applyTableOp(op, prev) || {};
  const next = { ...prev, ...patch };
  if (!next.mapConfig) {
    next.mapConfig = deriveMapConfigFromState(next);
  }
  return next;
}

function activeMapIdFromState(s) {
  return (
    s.mapViews?.find((v) => v.id === s.gmActiveViewId)?.mapId ??
    s.activeMapId ??
    s.maps?.[0]?.id ??
    null
  );
}

async function hostDataUrlIfNeeded(value, baseName = 'scene-image') {
  if (typeof value !== 'string' || !value.startsWith('data:')) return value;
  try {
    const { postMapImageFile } = await import('./api.js');
    const file = await dataUrlToFile(value, baseName);
    const uploaded = await postMapImageFile(file);
    return uploaded?.url || value;
  } catch (err) {
    console.warn('Scene editor image upload failed; keeping original value', err);
    return value;
  }
}

/**
 * Stable BattleMap mutation callbacks. `setSceneData` must be a function
 * `(updater: (prev) => next) => void` that always sees latest scene data
 * (ref-backed from the editor).
 *
 * @param {(updater: (prev: object) => object) => void} setSceneData
 * @param {{ viewportCenterRef?: { current: object | null } }} [opts]
 * @returns {object} callback props for `<BattleMap />`
 */
export function buildSceneTableAdapterProps(setSceneData, opts = {}) {
  const viewportCenterRef = opts.viewportCenterRef || { current: null };

  const applyOp = (op) => {
    setSceneData((prev) => applySceneTableOp(prev, op));
  };

  return {
    isPlayer: false,
    tableStateReady: true,
    tableName: 'Scene',
    className: 'flex-1 min-h-0',

    updateActiveElement: (instanceId, updates) => {
      applyOp({ op: 'update-element', instanceId, updates });
    },

    onMapConfigChange: (newConfig, resetTokenPositions = false) => {
      const patch = { ...(newConfig || {}) };
      if (typeof patch.mapImageUrl === 'string' && patch.mapImageUrl.startsWith('data:')) {
        void (async () => {
          patch.mapImageUrl = await hostDataUrlIfNeeded(patch.mapImageUrl, 'map-image');
          setSceneData((prev) => {
            const mid = activeMapIdFromState(normalizeSceneTableData(prev));
            return applySceneTableOp(prev, {
              op: 'set-map',
              ...patch,
              resetTokenPositions,
              ...(mid ? { mapId: mid } : {}),
            });
          });
        })();
        return;
      }
      setSceneData((prev) => {
        const mid = activeMapIdFromState(normalizeSceneTableData(prev));
        return applySceneTableOp(prev, {
          op: 'set-map',
          ...patch,
          resetTokenPositions,
          ...(mid ? { mapId: mid } : {}),
        });
      });
    },

    onMapViewSync: (mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm) => {
      setSceneData((prev) => {
        const s = normalizeSceneTableData(prev);
        const mapId = activeMapIdFromState(s);
        if (s.gmActiveViewId == null) {
          return applySceneTableOp(s, {
            op: 'set-map-view',
            mapViewZoomRatio,
            mapViewPanNorm,
            mapViewVisibleNorm,
            viewId: null,
            mapId,
          });
        }
        return applySceneTableOp(s, {
          op: 'set-map-view',
          mapViewZoomRatio,
          mapViewPanNorm,
          mapViewVisibleNorm,
          viewId: s.gmActiveViewId,
        });
      });
    },

    onSetActiveView: (viewId) => applyOp({ op: 'set-active-view', viewId }),
    onAddMapViewOp: (payload = {}) => applyOp({ op: 'add-map-view', ...payload }),
    onRemoveMapView: (viewId) => applyOp({ op: 'remove-map-view', viewId }),
    onRenameMapView: (viewId, name) => applyOp({ op: 'rename-map-view', viewId, name }),
    onSetViewBroadcast: (viewId, broadcastToPlayers) =>
      applyOp({ op: 'set-view-broadcast', viewId, broadcastToPlayers }),
    onSetViewLocked: (viewId, locked) => applyOp({ op: 'set-view-locked', viewId, locked }),
    onSetMapShare: (mapId, shareWithPlayers) => applyOp({ op: 'set-map-share', mapId, shareWithPlayers }),
    onSetActiveMap: (id) => applyOp({ op: 'set-active-map', activeMapId: id }),
    onAddMap: () => applyOp({ op: 'add-map' }),
    onRemoveMap: (mapId) => applyOp({ op: 'remove-map', mapId }),
    onRenameMap: (mapId, name) => applyOp({ op: 'rename-map', mapId, name }),
    onMapFreeExplore: (mapId) => applyOp({ op: 'set-map-free-explore', mapId }),

    onAddMapWithImage: async (img) => {
      let mapImageUrl = img.mapImageUrl;
      mapImageUrl = await hostDataUrlIfNeeded(mapImageUrl, 'map-image');
      applyOp({
        op: 'add-map',
        mapImageUrl,
        mapImageNaturalWidth: img.mapImageNaturalWidth,
        mapImageNaturalHeight: img.mapImageNaturalHeight,
        ...(Array.isArray(img.extraCameraVisibleNorms) && img.extraCameraVisibleNorms.length
          ? { extraCameraVisibleNorms: img.extraCameraVisibleNorms }
          : {}),
      });
    },

    onAddMapImageObject: async (file, placement = {}) => {
      const { postMapImageFile } = await import('./api.js');
      const uploaded = await postMapImageFile(file);
      if (!uploaded?.url) throw new Error('Map image upload did not return a URL');
      const { width, height } = await loadImageNaturalSizeFromUrl(uploaded.url);
      const defaultWidthFt = 20;
      const centerX = placement.centerXFt ?? viewportCenterRef.current?.xFt ?? null;
      const centerY = placement.centerYFt ?? viewportCenterRef.current?.yFt ?? null;
      const el = {
        instanceId: generateId(),
        elementType: 'mapImage',
        mapId: placement.mapId ?? viewportCenterRef.current?.mapId ?? null,
        viewId: placement.viewId ?? viewportCenterRef.current?.viewId ?? null,
        createdByUid: null,
        imageUrl: uploaded.url,
        imageNaturalWidth: width,
        imageNaturalHeight: height,
        tokenX: centerX,
        tokenY: centerY,
        widthFt: defaultWidthFt,
        heightFt: defaultWidthFt * (height / (width || 1)),
      };
      applyOp({ op: 'add-elements', elements: [el] });
    },

    onAddMapDrawShape: (shape) => {
      applyOp({ op: 'add-elements', elements: [{ ...shape, createdByUid: shape?.createdByUid ?? null }] });
    },
    onUpdateMapImageObject: (instanceId, updates) => {
      applyOp({ op: 'update-element', instanceId, updates });
    },
    onRemoveMapImageObject: (instanceId) => {
      applyOp({ op: 'remove-element', instanceId });
    },

    onSetMapOverlay: (mapId, overlayPng) => {
      void (async () => {
        const png = await hostDataUrlIfNeeded(overlayPng, 'map-overlay');
        applyOp({ op: 'set-map-overlay', mapId, overlayPng: png ?? null });
      })();
    },
    onSetMapViewOverlay: (viewId, overlayPng) => {
      void (async () => {
        const png = await hostDataUrlIfNeeded(overlayPng, 'map-view-overlay');
        applyOp({ op: 'set-map-view-overlay', viewId, overlayPng: png ?? null });
      })();
    },

    onViewportCenterChange: (center) => {
      viewportCenterRef.current = center;
    },

    onAddConditionsHistoryEntry: (entry) => {
      applyOp({ op: 'add-conditions-history-entry', entry });
    },
    onRemoveConditionsHistoryEntry: (entry) => {
      applyOp({ op: 'remove-conditions-history-entry', entry });
    },

    onRemoveAdversaryFromTable: (instanceId) => {
      applyOp({ op: 'remove-element', instanceId });
    },

    // Live-table / player-only: omit so BattleMap does not fire room APIs.
    // postMapPing / postMapScribble / postBannerAck are already guarded on
    // `tableId` inside BattleMap; we pass no tableId / gmUid / user.
  };
}

/**
 * Build a table-ready adversary/environment/note element from a library pick
 * (same shape `doAddToTable` uses on the live Game Table).
 * @param {object} item
 * @param {'adversaries'|'environments'|'notes'} collection
 * @returns {object}
 */
export function buildSceneElementFromLibraryItem(item, collection) {
  if (collection === 'adversaries') {
    return {
      ...item,
      instanceId: generateId(),
      elementType: 'adversary',
      currentHp: item.hp_max || 0,
      currentStress: 0,
      conditions: '',
    };
  }
  if (collection === 'environments') {
    return {
      ...item,
      instanceId: generateId(),
      elementType: 'environment',
    };
  }
  const id = item.id || generateId();
  return {
    instanceId: generateId(),
    elementType: 'note',
    id,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Note',
    body: typeof item.body === 'string' ? item.body : '',
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
  };
}
