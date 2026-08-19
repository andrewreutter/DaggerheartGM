import { describe, it, expect } from 'vitest';
import {
  MAP_CAMERA_PICKER_BORDER_PX,
  MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX,
  MAP_CAMERA_PICKER_HEADER_PX,
  MAP_CAMERA_PICKER_OVERLAY_PADDING_PX,
  mapCameraPickerAlignDelta,
  mapCameraPickerOverlayStyle,
  MAP_CAMERA_PICKER_ROW_CHROME_PX,
  mapCameraPickerMapsColumnWidthRem,
  mapCameraPickerRibbonAlignIndex,
  mapCameraPickerRibbonWidthRem,
  mapCameraPickerSectionGapRem,
  mapCameraPickerThumbEl,
  mapCameraPickerTriggerInsetRem,
  mapCameraPickerTriggerLeftPx,
  mapCameraTileActiveDuringHover,
  isCurrentMapCameraHoverTarget,
  isSameMapCameraHoverTarget,
  orderCamerasCurrentLast,
  orderMapGroupsCurrentFirst,
  resolveMapCameraHoverPreview,
  resolveMapCameraPickerTrigger,
} from '../../src/client/lib/map-camera-picker.js';

const mapA = { id: 'm-a', name: 'Alpha' };
const mapB = { id: 'm-b', name: 'Beta' };
const viewA1 = { id: 'v-a1', mapId: 'm-a', name: 'Cam A1' };
const viewB1 = { id: 'v-b1', mapId: 'm-b', name: 'Cam B1' };
const groups = [
  { map: mapA, views: [viewA1] },
  { map: mapB, views: [viewB1] },
];

describe('orderMapGroupsCurrentFirst', () => {
  it('moves the current map to the front and keeps the rest in order', () => {
    expect(orderMapGroupsCurrentFirst(groups, 'm-b').map((g) => g.map.id)).toEqual(['m-b', 'm-a']);
  });

  it('returns a copy when the current map is already first or missing', () => {
    expect(orderMapGroupsCurrentFirst(groups, 'm-a').map((g) => g.map.id)).toEqual(['m-a', 'm-b']);
    expect(orderMapGroupsCurrentFirst(groups, 'missing').map((g) => g.map.id)).toEqual(['m-a', 'm-b']);
    expect(orderMapGroupsCurrentFirst(groups, null)).not.toBe(groups);
  });

  it('returns an empty array for invalid groups', () => {
    expect(orderMapGroupsCurrentFirst(null, 'm-a')).toEqual([]);
    expect(orderMapGroupsCurrentFirst([], 'm-a')).toEqual([]);
  });
});

describe('orderCamerasCurrentLast', () => {
  const cams = [
    { id: 'v-a1', name: 'A1' },
    { id: 'v-a2', name: 'A2' },
    { id: 'v-a3', name: 'A3' },
  ];

  it('moves the current camera to the end and keeps the rest in order', () => {
    expect(orderCamerasCurrentLast(cams, 'v-a2').map((c) => c.id)).toEqual(['v-a1', 'v-a3', 'v-a2']);
  });

  it('returns a copy when the current camera is already last or missing', () => {
    expect(orderCamerasCurrentLast(cams, 'v-a3').map((c) => c.id)).toEqual(['v-a1', 'v-a2', 'v-a3']);
    expect(orderCamerasCurrentLast(cams, 'missing').map((c) => c.id)).toEqual(['v-a1', 'v-a2', 'v-a3']);
    expect(orderCamerasCurrentLast(cams, null)).not.toBe(cams);
  });

  it('returns an empty array for invalid cameras', () => {
    expect(orderCamerasCurrentLast(null, 'v-a1')).toEqual([]);
    expect(orderCamerasCurrentLast([], 'v-a1')).toEqual([]);
  });

  it('keeps the current camera last on the first wrap row when there are more than four', () => {
    const many = [
      { id: 'v-1' },
      { id: 'v-2' },
      { id: 'v-3' },
      { id: 'v-4' },
      { id: 'v-5' },
      { id: 'v-6' },
    ];
    expect(orderCamerasCurrentLast(many, 'v-2').map((c) => c.id)).toEqual([
      'v-1', 'v-3', 'v-4', 'v-2', 'v-5', 'v-6',
    ]);
  });
});

describe('mapCameraPickerRibbonAlignIndex', () => {
  it('is the last slot on the first wrap row', () => {
    expect(mapCameraPickerRibbonAlignIndex(0)).toBe(-1);
    expect(mapCameraPickerRibbonAlignIndex(3)).toBe(2);
    expect(mapCameraPickerRibbonAlignIndex(4)).toBe(3);
    expect(mapCameraPickerRibbonAlignIndex(8)).toBe(3);
  });
});

describe('resolveMapCameraPickerTrigger', () => {
  it('uses the GM named view when one is active', () => {
    expect(
      resolveMapCameraPickerTrigger({
        gmActiveViewId: 'v-b1',
        activeMapId: 'm-b',
        groups,
      }),
    ).toEqual({ kind: 'view', map: mapB, view: viewB1 });
  });

  it('uses the current map tile when the GM is in free explore', () => {
    expect(
      resolveMapCameraPickerTrigger({
        gmActiveViewId: null,
        activeMapId: 'm-a',
        groups,
      }),
    ).toEqual({ kind: 'map', map: mapA, view: null });
  });

  it('uses the player selected view unless they are free-exploring', () => {
    expect(
      resolveMapCameraPickerTrigger({
        isPlayer: true,
        playerFreeMapExplore: false,
        playerSelectedViewId: 'v-a1',
        activeMapId: 'm-a',
        groups,
      }),
    ).toEqual({ kind: 'view', map: mapA, view: viewA1 });
    expect(
      resolveMapCameraPickerTrigger({
        isPlayer: true,
        playerFreeMapExplore: true,
        playerSelectedViewId: 'v-a1',
        activeMapId: 'm-b',
        groups,
      }),
    ).toEqual({ kind: 'map', map: mapB, view: null });
  });

  it('returns null when there are no groups', () => {
    expect(resolveMapCameraPickerTrigger({ groups: [] })).toBeNull();
  });
});

describe('mapCameraPickerOverlayStyle', () => {
  const trigger = { left: 40, top: 24, right: 116 };
  const viewportWidth = 800;
  const expectedTop =
    24 - MAP_CAMERA_PICKER_OVERLAY_PADDING_PX - MAP_CAMERA_PICKER_BORDER_PX - MAP_CAMERA_PICKER_HEADER_PX - MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX - MAP_CAMERA_PICKER_ROW_CHROME_PX;

  it('anchors the overlay to the trigger’s right edge so the last camera stays on the chip', () => {
    expect(mapCameraPickerOverlayStyle(trigger, { viewportWidth })).toEqual({
      position: 'fixed',
      right: viewportWidth - 116 - MAP_CAMERA_PICKER_OVERLAY_PADDING_PX - MAP_CAMERA_PICKER_BORDER_PX,
      top: expectedTop,
    });
  });

  it('applies a measured align delta (positive x moves the overlay right)', () => {
    const base = mapCameraPickerOverlayStyle(trigger, { viewportWidth });
    expect(mapCameraPickerOverlayStyle(trigger, { viewportWidth, alignDelta: { x: 3, y: -5 } })).toEqual({
      position: 'fixed',
      right: base.right - 3,
      top: base.top - 5,
    });
  });

  it('falls back to left when the viewport width is unknown', () => {
    expect(mapCameraPickerOverlayStyle({ left: 40, top: 24 })).toEqual({
      position: 'fixed',
      left: 40 - MAP_CAMERA_PICKER_OVERLAY_PADDING_PX - MAP_CAMERA_PICKER_BORDER_PX,
      top: expectedTop,
    });
  });

  it('returns null without a usable trigger rect', () => {
    expect(mapCameraPickerOverlayStyle(null)).toBeNull();
    expect(mapCameraPickerOverlayStyle({ left: NaN, top: 0 })).toBeNull();
  });
});

describe('mapCameraPickerAlignDelta', () => {
  it('returns the delta that would move the first tile onto the trigger', () => {
    expect(
      mapCameraPickerAlignDelta({ left: 40, top: 24 }, { left: 42, top: 20 }),
    ).toEqual({ x: -2, y: 4 });
  });

  it('returns a zero delta without usable rects', () => {
    expect(mapCameraPickerAlignDelta(null, { left: 1, top: 1 })).toEqual({ x: 0, y: 0 });
  });
});

describe('mapCameraPickerThumbEl', () => {
  it('prefers the marked thumb over the wrapper', () => {
    const thumb = { id: 'thumb' };
    const root = {
      querySelector: (sel) => (String(sel).includes('data-map-camera-thumb') ? thumb : null),
    };
    expect(mapCameraPickerThumbEl(root)).toBe(thumb);
  });

  it('falls back to the root when no thumb is marked', () => {
    const root = { querySelector: () => null };
    expect(mapCameraPickerThumbEl(root)).toBe(root);
    expect(mapCameraPickerThumbEl(null)).toBeNull();
  });
});

describe('mapCameraPickerTriggerLeftPx', () => {
  it('is the title left minus the viewport left', () => {
    expect(mapCameraPickerTriggerLeftPx({ left: 420 }, { left: 80 })).toBe(340);
  });

  it('returns null without usable rects', () => {
    expect(mapCameraPickerTriggerLeftPx(null, { left: 80 })).toBeNull();
    expect(mapCameraPickerTriggerLeftPx({ left: 420 }, null)).toBeNull();
  });
});

describe('mapCameraPickerTriggerInsetRem', () => {
  it('insets the idle chip by 20% of the tile width', () => {
    expect(mapCameraPickerTriggerInsetRem()).toBe('1.45rem');
  });
});

describe('mapCameraPickerRibbonWidthRem', () => {
  it('is one tile wide when empty or a single camera (heading may still be wider)', () => {
    expect(mapCameraPickerRibbonWidthRem(0)).toBe('4.75rem');
    expect(mapCameraPickerRibbonWidthRem(1)).toBe('4.75rem');
  });

  it('includes gaps between cameras', () => {
    expect(mapCameraPickerRibbonWidthRem(3)).toBe('15rem');
  });

  it('caps at four tiles so extra cameras wrap', () => {
    expect(mapCameraPickerRibbonWidthRem(4)).toBe('20.125rem');
    expect(mapCameraPickerRibbonWidthRem(8)).toBe('20.125rem');
  });
});

describe('mapCameraPickerSectionGapRem', () => {
  it('is 25% of a tile width', () => {
    expect(mapCameraPickerSectionGapRem()).toBe('1.1875rem');
  });
});

describe('mapCameraPickerMapsColumnWidthRem', () => {
  it('is the map tile plus the size/artist column', () => {
    expect(mapCameraPickerMapsColumnWidthRem()).toBe('13.625rem');
  });
});

describe('isSameMapCameraHoverTarget', () => {
  it('compares kind + id and treats nulls as equal only to each other', () => {
    expect(isSameMapCameraHoverTarget(null, null)).toBe(true);
    expect(isSameMapCameraHoverTarget({ kind: 'view', viewId: 'v-a1' }, { kind: 'view', viewId: 'v-a1' })).toBe(true);
    expect(isSameMapCameraHoverTarget({ kind: 'view', viewId: 'v-a1' }, { kind: 'view', viewId: 'v-b1' })).toBe(false);
    expect(isSameMapCameraHoverTarget({ kind: 'map', mapId: 'm-a' }, { kind: 'view', viewId: 'v-a1' })).toBe(false);
    expect(isSameMapCameraHoverTarget({ kind: 'map', mapId: 'm-a' }, null)).toBe(false);
  });
});

describe('isCurrentMapCameraHoverTarget', () => {
  it('treats a named view as current only when that view is committed', () => {
    expect(isCurrentMapCameraHoverTarget({ kind: 'view', viewId: 'v-a1' }, { currentViewId: 'v-a1', currentMapId: 'm-a' })).toBe(true);
    expect(isCurrentMapCameraHoverTarget({ kind: 'view', viewId: 'v-b1' }, { currentViewId: 'v-a1', currentMapId: 'm-a' })).toBe(false);
  });

  it('treats a map tile as current only while free-exploring that map', () => {
    expect(isCurrentMapCameraHoverTarget({ kind: 'map', mapId: 'm-a' }, { currentViewId: null, currentMapId: 'm-a' })).toBe(true);
    expect(isCurrentMapCameraHoverTarget({ kind: 'map', mapId: 'm-a' }, { currentViewId: 'v-a1', currentMapId: 'm-a' })).toBe(false);
    expect(isCurrentMapCameraHoverTarget({ kind: 'map', mapId: 'm-b' }, { currentViewId: null, currentMapId: 'm-a' })).toBe(false);
  });
});

describe('mapCameraTileActiveDuringHover', () => {
  it('highlights the previewed tile and ignores the committed fallback', () => {
    expect(mapCameraTileActiveDuringHover({ kind: 'view', viewId: 'v-b1' }, { kind: 'view', id: 'v-b1', fallback: false })).toBe(true);
    expect(mapCameraTileActiveDuringHover({ kind: 'view', viewId: 'v-b1' }, { kind: 'view', id: 'v-a1', fallback: true })).toBe(false);
    expect(mapCameraTileActiveDuringHover({ kind: 'map', mapId: 'm-b' }, { kind: 'map', id: 'm-b', fallback: false })).toBe(true);
    expect(mapCameraTileActiveDuringHover(null, { kind: 'view', id: 'v-a1', fallback: true })).toBe(true);
  });
});

describe('resolveMapCameraHoverPreview', () => {
  const maps = [
    { id: 'm-a', name: 'Alpha', mapImageUrl: 'a.png', mapSizeFt: 200, mapDimension: 'width' },
    { id: 'm-b', name: 'Beta', mapImageUrl: 'b.png', mapSizeFt: 300, mapDimension: 'width' },
  ];
  const mapViews = [
    {
      id: 'v-a1',
      mapId: 'm-a',
      name: 'Cam A1',
      mapViewZoomRatio: 0.4,
      mapViewPanNorm: { x: 0.2, y: 0.3 },
      mapViewVisibleNorm: { x: 0.1, y: 0.15, w: 0.5, h: 0.4 },
    },
    {
      id: 'v-b1',
      mapId: 'm-b',
      name: 'Cam B1',
      mapViewZoomRatio: 0.8,
      mapViewPanNorm: { x: 0.5, y: 0.5 },
      mapViewVisibleNorm: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
    },
  ];

  it('returns null for the committed camera or a missing target', () => {
    expect(resolveMapCameraHoverPreview({
      target: { kind: 'view', viewId: 'v-a1' },
      maps,
      mapViews,
      currentViewId: 'v-a1',
      currentMapId: 'm-a',
    })).toBeNull();
    expect(resolveMapCameraHoverPreview({ target: null, maps, mapViews })).toBeNull();
    expect(resolveMapCameraHoverPreview({
      target: { kind: 'view', viewId: 'missing' },
      maps,
      mapViews,
      currentViewId: 'v-a1',
    })).toBeNull();
  });

  it('builds a camera preview from the named view’s stored framing', () => {
    const preview = resolveMapCameraHoverPreview({
      target: { kind: 'view', viewId: 'v-b1' },
      maps,
      mapViews,
      currentViewId: 'v-a1',
      currentMapId: 'm-a',
    });
    expect(preview).toMatchObject({
      kind: 'view',
      viewId: 'v-b1',
      mapId: 'm-b',
      fitToView: false,
    });
    expect(preview.mapConfig.mapImageUrl).toBe('b.png');
    expect(preview.mapConfig.mapViewVisibleNorm).toEqual(mapViews[1].mapViewVisibleNorm);
  });

  it('uses gmMapView framing when peeking a map that was last free-explored', () => {
    const preview = resolveMapCameraHoverPreview({
      target: { kind: 'map', mapId: 'm-b' },
      maps,
      mapViews,
      currentViewId: 'v-a1',
      currentMapId: 'm-a',
      gmMapView: {
        mapId: 'm-b',
        mapViewZoomRatio: 0.25,
        mapViewPanNorm: { x: 0.1, y: 0.2 },
        mapViewVisibleNorm: { x: 0, y: 0, w: 1, h: 1 },
      },
    });
    expect(preview).toMatchObject({ kind: 'map', mapId: 'm-b', viewId: null, fitToView: false });
    expect(preview.mapConfig.mapImageUrl).toBe('b.png');
    expect(preview.mapConfig.mapViewZoomRatio).toBe(0.25);
  });

  it('fits a map with no stored free-explore framing', () => {
    const preview = resolveMapCameraHoverPreview({
      target: { kind: 'map', mapId: 'm-b' },
      maps,
      mapViews,
      currentViewId: 'v-a1',
      currentMapId: 'm-a',
      gmMapView: { mapId: 'm-a', mapViewZoomRatio: 0.5 },
    });
    expect(preview).toMatchObject({ kind: 'map', mapId: 'm-b', fitToView: true });
    expect(preview.mapConfig.mapImageUrl).toBe('b.png');
    expect(preview.mapConfig.mapViewZoomRatio).toBeNull();
  });
});
