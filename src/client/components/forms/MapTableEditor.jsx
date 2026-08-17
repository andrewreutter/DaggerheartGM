import { useMemo, useRef, useCallback } from 'react';
import { BattleMap } from '../BattleMap.jsx';
import {
  applySceneTableOp,
  buildSceneTableAdapterProps,
  hostDataUrlIfNeeded,
} from '../../lib/scene-table-adapter.js';
import { libraryMapToEditorSlice } from '../../lib/map-library.js';

/**
 * One-map BattleMap editor for a library Map (cameras, draw tools, overlays, placed images).
 * No encounter panel, adversaries, notes, countdowns, or Add/Remove Map.
 */
export function MapTableEditor({ value, onChange }) {
  const slice = useMemo(() => {
    if (Array.isArray(value?.maps) && value.maps.length) return value;
    return libraryMapToEditorSlice(value);
  }, [value]);
  const viewportCenterRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const latestRef = useRef(slice);
  latestRef.current = slice;

  const setSceneData = useCallback((updater) => {
    const prev = latestRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    latestRef.current = next;
    onChangeRef.current(next);
  }, []);

  const battleMapCallbacks = useMemo(() => {
    const base = buildSceneTableAdapterProps(setSceneData, { viewportCenterRef });
    return {
      ...base,
      className: 'flex-1 min-w-0 min-h-0',
      tableName: slice.maps?.[0]?.name || 'Map',
      onAddMap: undefined,
      onRemoveMap: undefined,
      onAddMapWithImage: async (img) => {
        let mapImageUrl = img.mapImageUrl;
        if (typeof mapImageUrl === 'string' && mapImageUrl.startsWith('data:')) {
          mapImageUrl = await hostDataUrlIfNeeded(mapImageUrl, 'map-image');
        }
        const mid = latestRef.current?.maps?.[0]?.id;
        setSceneData((prev) => applySceneTableOp(prev, {
          op: 'set-map',
          mapId: mid,
          mapImageUrl,
          mapImageNaturalWidth: img.mapImageNaturalWidth,
          mapImageNaturalHeight: img.mapImageNaturalHeight,
        }));
      },
    };
  }, [setSceneData, slice.maps]);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
      <BattleMap
        {...battleMapCallbacks}
        maps={slice.maps}
        mapViews={slice.mapViews}
        gmActiveViewId={slice.gmActiveViewId}
        activeElements={slice.activeElements || []}
        mapConfig={slice.mapConfig}
        className="flex-1 min-w-0 min-h-0"
      />
    </div>
  );
}
