import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileImage, Focus, Loader2, Plus, Trash2 } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { Tooltip } from '../Tooltip.jsx';
import { generateId } from '../../lib/helpers.js';
import {
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  computeImageViewportZoomBounds,
  computeZoomAndPanToFitInnerBounds,
} from '../../lib/battle-map-zoom.js';
import { ocrLayoutRegion } from '../../lib/unified-import-resolve.js';
import { defaultFullRect } from '../../lib/unified-import-reconcile.js';
import { UnifiedImportSliceThumb } from '../../lib/unified-import-thumb.jsx';
import { ImportSliceDestinationControls } from './ImportSliceDestinationControls.jsx';

const REGION_STRIP_THUMB = 64;
const MIN_RECT = 6;
const HANDLE = 5;
const OCR_DEBOUNCE_MS = 320;

const HANDLE_CURSORS = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeRect(x0, y0, x1, y1) {
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  };
}

function hitHandle(px, py, b, mapZoom) {
  const h = HANDLE / mapZoom;
  const { x0, y0, x1, y1 } = b;
  const pts = {
    nw: [x0, y0],
    n: [(x0 + x1) / 2, y0],
    ne: [x1, y0],
    e: [x1, (y0 + y1) / 2],
    se: [x1, y1],
    s: [(x0 + x1) / 2, y1],
    sw: [x0, y1],
    w: [x0, (y0 + y1) / 2],
  };
  for (const [name, [hx, hy]] of Object.entries(pts)) {
    if (Math.abs(px - hx) <= h && Math.abs(py - hy) <= h) return name;
  }
  return null;
}

function pointInRect(x, y, b) {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

function rectChanged(a, b) {
  return a.x0 !== b.x0 || a.y0 !== b.y0 || a.x1 !== b.x1 || a.y1 !== b.y1;
}

/**
 * Full-page editor: multiple draggable/resizable regions, draw new rectangles on empty canvas.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ width: number, height: number, dataUrl: string }} props.layout
 * @param {{ id: string, rect: object, ocrText?: string, ocrHasText?: boolean, ocrComplete?: boolean }[]} props.regions
 * @param {(regions: object[]) => void} props.onRegionsChange
 * @param {string} [props.fileName]
 * @param {string} [props.zIndexClass]
 * @param {string | null} [props.importAssetId] — when set, show per-slice import controls (same as import step 2)
 * @param {object[]} [props.allImportSliceRows] — full import slice list (for attach targets + row lookup)
 * @param {(id: string, patch: object) => void} [props.updateSlice]
 * @param {boolean} [props.isGameTableGm]
 * @param {((img: object) => void) | undefined} [props.onAddMapWithImage]
 * @param {string[]} [props.textSliceCollectionOptions]
 */
export function ImageRegionsEditor({
  open,
  onClose,
  layout,
  regions,
  onRegionsChange,
  fileName = '',
  zIndexClass = 'z-[10051]',
  importAssetId = null,
  allImportSliceRows = [],
  updateSlice,
  isGameTableGm = false,
  onAddMapWithImage,
  textSliceCollectionOptions = [],
}) {
  const W = layout?.width ?? 0;
  const H = layout?.height ?? 0;
  const dataUrl = layout?.dataUrl ?? '';
  const layoutKey = layout?.dataUrl ?? '';

  const [selectedId, setSelectedId] = useState(null);
  const [draftNew, setDraftNew] = useState(null);
  /** Region ids currently waiting on server OCR (after debounce). */
  const [ocrInFlightIds, setOcrInFlightIds] = useState(() => new Set());
  const timerByRegionRef = useRef(new Map());
  const rectSigByRegionRef = useRef(new Map());

  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPanLeft, setMapPanLeft] = useState(0);
  const [mapPanTop, setMapPanTop] = useState(0);
  const [rightPanDragging, setRightPanDragging] = useState(false);
  const [hoverCursor, setHoverCursor] = useState('crosshair');

  const viewportRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  const regionsRef = useRef(regions);
  const dragRef = useRef(null);
  const lastFitKeyRef = useRef(null);
  const panRightDragRef = useRef(null);
  const rightPanDraggingRef = useRef(false);
  rightPanDraggingRef.current = rightPanDragging;

  const mapZoomRef = useRef(1);
  const mapPanLeftRef = useRef(0);
  const mapPanTopRef = useRef(0);
  mapZoomRef.current = mapZoom;
  mapPanLeftRef.current = mapPanLeft;
  mapPanTopRef.current = mapPanTop;

  regionsRef.current = regions;

  const selected = useMemo(() => regions.find((r) => r.id === selectedId) ?? null, [regions, selectedId]);

  const { minZoom, maxZoom } = useMemo(
    () =>
      computeImageViewportZoomBounds({
        containerW,
        containerH,
        imageWidthPx: W,
        imageHeightPx: H,
      }),
    [containerW, containerH, W, H],
  );

  const minZoomRef = useRef(minZoom);
  const maxZoomRef = useRef(maxZoom);
  minZoomRef.current = minZoom;
  maxZoomRef.current = maxZoom;

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setContainerW(el.clientWidth);
      setContainerH(el.clientHeight);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    setContainerH(el.clientHeight);
    return () => ro.disconnect();
  }, [open, layoutKey]);

  useEffect(() => {
    if (!open) lastFitKeyRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open || !layoutKey || W <= 0 || H <= 0) return;
    setDraftNew(null);
    setSelectedId((sid) => (sid && regions.some((r) => r.id === sid) ? sid : regions[0]?.id ?? null));
    setHoverCursor('crosshair');
  }, [open, layoutKey, W, H, regions]);

  useLayoutEffect(() => {
    if (!open || !layoutKey || containerW <= 0 || W <= 0) return;
    const { minZoom: fit } = computeImageViewportZoomBounds({
      containerW,
      containerH,
      imageWidthPx: W,
      imageHeightPx: H,
    });
    if (lastFitKeyRef.current !== layoutKey) {
      lastFitKeyRef.current = layoutKey;
      mapZoomRef.current = fit;
      mapPanLeftRef.current = 0;
      mapPanTopRef.current = 0;
      setMapZoom(fit);
      setMapPanLeft(0);
      setMapPanTop(0);
    }
  }, [open, layoutKey, containerW, containerH, W, H]);

  useLayoutEffect(() => {
    setMapZoom((z) => clampMapZoom(z, minZoom, maxZoom));
  }, [minZoom, maxZoom]);

  useLayoutEffect(() => {
    if (containerW <= 0 || W <= 0) return;
    const c = clampPanScroll(mapPanLeftRef.current, mapPanTopRef.current, {
      mapZoom: mapZoomRef.current,
      renderedWidthPx: W,
      renderedHeightPx: H,
      viewportW: containerW,
      viewportH: containerH,
    });
    if (c.scrollLeft !== mapPanLeftRef.current || c.scrollTop !== mapPanTopRef.current) {
      mapPanLeftRef.current = c.scrollLeft;
      mapPanTopRef.current = c.scrollTop;
      setMapPanLeft(c.scrollLeft);
      setMapPanTop(c.scrollTop);
    }
  }, [mapZoom, containerW, containerH, W, H]);

  const onRegionsChangeRef = useRef(onRegionsChange);
  onRegionsChangeRef.current = onRegionsChange;

  useEffect(() => {
    if (!open || !layoutKey || !dataUrl || W <= 0 || H <= 0) return;

    for (const reg of regions) {
      if (reg.ocrComplete) {
        const tid = timerByRegionRef.current.get(reg.id);
        if (tid) clearTimeout(tid);
        timerByRegionRef.current.delete(reg.id);
        rectSigByRegionRef.current.delete(reg.id);
        continue;
      }

      const sig = `${reg.rect.x0},${reg.rect.y0},${reg.rect.x1},${reg.rect.y1}`;
      if (rectSigByRegionRef.current.get(reg.id) === sig) continue;
      rectSigByRegionRef.current.set(reg.id, sig);

      const prevT = timerByRegionRef.current.get(reg.id);
      if (prevT) clearTimeout(prevT);

      const regionId = reg.id;
      const t = setTimeout(() => {
        timerByRegionRef.current.delete(regionId);
        const ac = new AbortController();
        setOcrInFlightIds((s) => new Set(s).add(regionId));
        void (async () => {
          try {
            const rNow = regionsRef.current.find((r) => r.id === regionId);
            if (!rNow || rNow.ocrComplete) return;
            const { ocrText, ocrHasText } = await ocrLayoutRegion(dataUrl, rNow.rect, { signal: ac.signal });
            if (ac.signal.aborted) return;
            if (!openRef.current) return;
            onRegionsChangeRef.current(
              regionsRef.current.map((r) =>
                r.id === regionId ? { ...r, ocrText, ocrHasText, ocrComplete: true } : r,
              ),
            );
          } catch (e) {
            if (e?.name === 'AbortError') return;
            if (!openRef.current) return;
            onRegionsChangeRef.current(
              regionsRef.current.map((r) =>
                r.id === regionId ? { ...r, ocrText: '', ocrHasText: false, ocrComplete: true } : r,
              ),
            );
          } finally {
            setOcrInFlightIds((s) => {
              const n = new Set(s);
              n.delete(regionId);
              return n;
            });
          }
        })();
      }, OCR_DEBOUNCE_MS);
      timerByRegionRef.current.set(regionId, t);
    }

    for (const id of [...timerByRegionRef.current.keys()]) {
      if (!regions.some((r) => r.id === id)) {
        clearTimeout(timerByRegionRef.current.get(id));
        timerByRegionRef.current.delete(id);
        rectSigByRegionRef.current.delete(id);
      }
    }
  }, [open, layoutKey, dataUrl, W, H, regions]);

  useEffect(() => {
    if (open) return undefined;
    return () => {
      for (const t of timerByRegionRef.current.values()) clearTimeout(t);
      timerByRegionRef.current.clear();
      rectSigByRegionRef.current.clear();
    };
  }, [open]);

  const onWheelViewport = useCallback(
    (e) => {
      const el = viewportRef.current;
      if (!el) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;
      const rectEl = el.getBoundingClientRect();
      const viewportX = e.clientX - rectEl.left;
      const viewportY = e.clientY - rectEl.top;
      const next = applyViewportWheelPanZoom(e, {
        viewportW: vw,
        viewportH: vh,
        viewportX,
        viewportY,
        scrollLeft: mapPanLeftRef.current,
        scrollTop: mapPanTopRef.current,
        mapZoom: mapZoomRef.current,
        minZoom: minZoomRef.current,
        maxZoom: maxZoomRef.current,
        renderedWidthPx: W,
        renderedHeightPx: H,
      });
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      mapZoomRef.current = next.mapZoom;
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapZoom(next.mapZoom);
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
    },
    [W, H],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return undefined;
    el.addEventListener('wheel', onWheelViewport, { passive: false });
    return () => el.removeEventListener('wheel', onWheelViewport);
  }, [onWheelViewport, open]);

  const clientToWorld = useCallback(
    (clientX, clientY) => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const mx = clientX - r.left + mapPanLeftRef.current;
      const my = clientY - r.top + mapPanTopRef.current;
      const z = mapZoomRef.current;
      return {
        x: clamp(mx / z, 0, W),
        y: clamp(my / z, 0, H),
      };
    },
    [W, H],
  );

  const updateHoverCursor = useCallback(
    (clientX, clientY) => {
      if (!W || !H || dragRef.current) return;
      const { x, y } = clientToWorld(clientX, clientY);
      const z = mapZoomRef.current;
      const list = regionsRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const h = hitHandle(x, y, list[i].rect, z);
        if (h) {
          setHoverCursor(HANDLE_CURSORS[h] || 'default');
          return;
        }
      }
      for (let i = list.length - 1; i >= 0; i--) {
        if (pointInRect(x, y, list[i].rect)) {
          setHoverCursor('move');
          return;
        }
      }
      setHoverCursor('crosshair');
    },
    [W, H, clientToWorld],
  );

  const handleRightPanPointerDown = useCallback((e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    panRightDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanLeft: mapPanLeftRef.current,
      startPanTop: mapPanTopRef.current,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setRightPanDragging(true);
  }, []);

  const handleRightPanPointerMove = useCallback(
    (e) => {
      const d = panRightDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.preventDefault();
      const el = viewportRef.current;
      const vw = el?.clientWidth ?? 0;
      const vh = el?.clientHeight ?? 0;
      if (vw <= 0 || vh <= 0) return;
      const z = mapZoomRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const next = clampPanScroll(
        d.startPanLeft - dx,
        d.startPanTop - dy,
        { mapZoom: z, renderedWidthPx: W, renderedHeightPx: H, viewportW: vw, viewportH: vh },
      );
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
    },
    [W, H],
  );

  const handleRightPanPointerUp = useCallback((e) => {
    const d = panRightDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    panRightDragRef.current = null;
    setRightPanDragging(false);
  }, []);

  const handleRightPanLostCapture = useCallback((e) => {
    const d = panRightDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    panRightDragRef.current = null;
    setRightPanDragging(false);
  }, []);

  const applyZoomToFitSelection = useCallback(() => {
    const el = viewportRef.current;
    if (!el || W <= 0 || H <= 0 || !selected) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    const b = selected.rect;
    const result = computeZoomAndPanToFitInnerBounds({
      minInnerX: b.x0,
      minInnerY: b.y0,
      maxInnerX: b.x1,
      maxInnerY: b.y1,
      paddingPx: 12,
      minZoom: minZoomRef.current,
      maxZoom: maxZoomRef.current,
      renderedWidthPx: W,
      renderedHeightPx: H,
      viewportW: vw,
      viewportH: vh,
    });
    mapZoomRef.current = result.mapZoom;
    mapPanLeftRef.current = result.scrollLeft;
    mapPanTopRef.current = result.scrollTop;
    setMapZoom(result.mapZoom);
    setMapPanLeft(result.scrollLeft);
    setMapPanTop(result.scrollTop);
  }, [selected, W, H]);

  const patchRegion = useCallback(
    (regionId, rect) => {
      const next = regionsRef.current.map((r) => (r.id === regionId ? { ...r, rect } : r));
      onRegionsChange(next);
    },
    [onRegionsChange],
  );

  const onPointerDown = (e) => {
    if (!W || !H) return;
    if (e.button !== 0) return;
    const { x, y } = clientToWorld(e.clientX, e.clientY);
    const list = regionsRef.current;
    const z = mapZoomRef.current;

    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      const h = hitHandle(x, y, r.rect, z);
      if (h) {
        setSelectedId(r.id);
        dragRef.current = {
          type: 'resize',
          handle: h,
          regionId: r.id,
          start: { ...r.rect },
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (pointInRect(x, y, r.rect)) {
        setSelectedId(r.id);
        dragRef.current = {
          type: 'move',
          regionId: r.id,
          start: { ...r.rect },
          startX: x,
          startY: y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    setSelectedId(null);
    dragRef.current = { type: 'new', startX: x, startY: y };
    setDraftNew(normalizeRect(x, y, x, y));
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) {
      if (!rightPanDraggingRef.current) updateHoverCursor(e.clientX, e.clientY);
      return;
    }
    const { x, y } = clientToWorld(e.clientX, e.clientY);

    if (d.type === 'resize') {
      const s0 = d.start;
      let x0 = s0.x0;
      let y0 = s0.y0;
      let x1 = s0.x1;
      let y1 = s0.y1;
      const hname = d.handle;
      if (hname.includes('e')) x1 = x;
      if (hname.includes('w')) x0 = x;
      if (hname.includes('s')) y1 = y;
      if (hname.includes('n')) y0 = y;
      const nr = normalizeRect(x0, y0, x1, y1);
      if (nr.x1 - nr.x0 < MIN_RECT || nr.y1 - nr.y0 < MIN_RECT) return;
      nr.x0 = clamp(nr.x0, 0, W);
      nr.x1 = clamp(nr.x1, 0, W);
      nr.y0 = clamp(nr.y0, 0, H);
      nr.y1 = clamp(nr.y1, 0, H);
      patchRegion(d.regionId, nr);
      setHoverCursor(HANDLE_CURSORS[d.handle] || 'default');
      return;
    }

    if (d.type === 'move') {
      const s0 = d.start;
      const dx = x - d.startX;
      const dy = y - d.startY;
      let x0 = s0.x0 + dx;
      let y0 = s0.y0 + dy;
      let x1 = s0.x1 + dx;
      let y1 = s0.y1 + dy;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (x0 < 0) {
        x0 = 0;
        x1 = bw;
      }
      if (x1 > W) {
        x1 = W;
        x0 = W - bw;
      }
      if (y0 < 0) {
        y0 = 0;
        y1 = bh;
      }
      if (y1 > H) {
        y1 = H;
        y0 = H - bh;
      }
      patchRegion(d.regionId, { x0, y0, x1, y1 });
      return;
    }

    if (d.type === 'new') {
      setDraftNew(normalizeRect(d.startX, d.startY, x, y));
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (d?.type === 'resize' || d?.type === 'move') {
      const rNow = regionsRef.current.find((x) => x.id === d.regionId);
      if (rNow && rectChanged(d.start, rNow.rect)) {
        const tid = timerByRegionRef.current.get(d.regionId);
        if (tid) clearTimeout(tid);
        timerByRegionRef.current.delete(d.regionId);
        rectSigByRegionRef.current.delete(d.regionId);
        onRegionsChangeRef.current(
          regionsRef.current.map((r) =>
            r.id === d.regionId ? { ...r, ocrText: undefined, ocrHasText: undefined, ocrComplete: false } : r,
          ),
        );
      }
    }

    if (d?.type === 'new') {
      const { x, y } = clientToWorld(e.clientX, e.clientY);
      const nr = normalizeRect(d.startX, d.startY, x, y);
      setDraftNew(null);
      if (nr.x1 - nr.x0 >= MIN_RECT && nr.y1 - nr.y0 >= MIN_RECT) {
        const id = generateId();
        onRegionsChange([...regionsRef.current, { id, rect: nr }]);
        setSelectedId(id);
      }
    }
    updateHoverCursor(e.clientX, e.clientY);
  };

  const removeSelected = useCallback(() => {
    if (!selectedId || regions.length <= 1) return;
    const next = regions.filter((r) => r.id !== selectedId);
    onRegionsChange(next);
    setSelectedId(next[0]?.id ?? null);
  }, [selectedId, regions, onRegionsChange]);

  const addFullImageRegion = () => {
    const id = generateId();
    onRegionsChange([...regions, { id, rect: defaultFullRect(W, H) }]);
    setSelectedId(id);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev) => {
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
      const t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      ev.preventDefault();
      removeSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, removeSelected]);

  const draftNorm = draftNew ? normalizeRect(draftNew.x0, draftNew.y0, draftNew.x1, draftNew.y1) : null;
  const layoutForThumb = useMemo(() => ({ width: W, height: H, dataUrl }), [W, H, dataUrl]);

  return (
    <FullPageOverlay
      open={open && !!layout && W > 0 && H > 0}
      onClose={onClose}
      zIndexClass={zIndexClass}
      maxWidthClass="max-w-5xl"
      heightClass="h-[min(92vh,920px)]"
      ariaLabelledBy="image-regions-editor-title"
    >
      <FullPageOverlayHeader
        titleId="image-regions-editor-title"
        title="Image regions"
        subtitle={
          fileName ||
          (W && H
            ? `${W}×${H}px — wheel pan · Shift+wheel horizontal · ⌘/Ctrl+wheel zoom · right-drag pan · drag empty space to draw a region`
            : '')
        }
        icon={FileImage}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
        <p className="text-[11px] text-dh-muted shrink-0">
          Each region becomes one import slice. Drag on the image to draw a new rectangle. Click a region to select it; drag inside to move, drag handles to resize.{' '}
          <span className="text-dh-muted/80">Delete or Backspace removes the selected region (keeps at least one).</span>
        </p>
        <div className="flex min-h-0 flex-1 gap-3">
          <div
            ref={viewportRef}
            className={`relative min-h-[200px] flex-1 overflow-hidden rounded-lg border border-dh-border bg-dh-canvas touch-none ${
              rightPanDragging ? 'cursor-grabbing' : ''
            }`}
            onPointerDown={handleRightPanPointerDown}
            onPointerMove={handleRightPanPointerMove}
            onPointerUp={handleRightPanPointerUp}
            onPointerCancel={handleRightPanPointerUp}
            onLostPointerCapture={handleRightPanLostCapture}
            onContextMenu={(ev) => {
              ev.preventDefault();
            }}
          >
            <div
              className="relative shrink-0 will-change-transform"
              style={{
                transform: `translate(${-mapPanLeft}px, ${-mapPanTop}px)`,
                width: W * mapZoom,
                height: H * mapZoom,
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: W,
                  height: H,
                  transform: `scale(${mapZoom})`,
                }}
              >
                <img src={dataUrl} alt="" width={W} height={H} className="block max-w-none select-none pointer-events-none" draggable={false} />
                <div
                  role="presentation"
                  className="absolute inset-0"
                  style={{
                    cursor: rightPanDragging ? 'grabbing' : hoverCursor,
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onPointerLeave={() => {
                    if (!dragRef.current && !rightPanDraggingRef.current) setHoverCursor('crosshair');
                  }}
                />
                {regions.map((reg) => {
                  const isSel = reg.id === selectedId;
                  const b = reg.rect;
                  const rw = b.x1 - b.x0;
                  const rh = b.y1 - b.y0;
                  if (rw < 1 || rh < 1) return null;
                  return (
                    <div
                      key={reg.id}
                      className="pointer-events-none absolute z-[5]"
                      style={{
                        left: `${(b.x0 / W) * 100}%`,
                        top: `${(b.y0 / H) * 100}%`,
                        width: `${(rw / W) * 100}%`,
                        height: `${(rh / H) * 100}%`,
                      }}
                    >
                      <div
                        className={`absolute inset-0 border-2 ${isSel ? 'border-sky-400 bg-sky-500/15' : 'border-dashed border-violet-400/70 bg-violet-500/10'}`}
                      />
                      {isSel &&
                        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((name) => {
                          const pts = {
                            nw: [b.x0, b.y0],
                            n: [(b.x0 + b.x1) / 2, b.y0],
                            ne: [b.x1, b.y0],
                            e: [b.x1, (b.y0 + b.y1) / 2],
                            se: [b.x1, b.y1],
                            s: [(b.x0 + b.x1) / 2, b.y1],
                            sw: [b.x0, b.y1],
                            w: [b.x0, (b.y0 + b.y1) / 2],
                          };
                          const [hx, hy] = pts[name];
                          const hw = (HANDLE * 2) / mapZoom;
                          return (
                            <div
                              key={name}
                              className="pointer-events-none absolute z-10 rounded-sm border border-dh-border bg-dh-surface shadow"
                              style={{
                                left: `${((hx - b.x0) / rw) * 100}%`,
                                top: `${((hy - b.y0) / rh) * 100}%`,
                                width: `${(hw / rw) * 100}%`,
                                height: `${(hw / rh) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: HANDLE_CURSORS[name],
                              }}
                            />
                          );
                        })}
                    </div>
                  );
                })}
                {draftNorm && draftNorm.x1 - draftNorm.x0 >= 1 && draftNorm.y1 - draftNorm.y0 >= 1 ? (
                  <div
                    className="pointer-events-none absolute z-[6] border-2 border-amber-400 border-dashed bg-amber-500/10"
                    style={{
                      left: `${(draftNorm.x0 / W) * 100}%`,
                      top: `${(draftNorm.y0 / H) * 100}%`,
                      width: `${((draftNorm.x1 - draftNorm.x0) / W) * 100}%`,
                      height: `${((draftNorm.y1 - draftNorm.y0) / H) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
            <div className="pointer-events-none absolute right-2 bottom-2 z-20">
              <Tooltip label="Zoom to selected region">
                <button
                  type="button"
                  tabIndex={0}
                  aria-label="Zoom to selected region"
                  disabled={!selected}
                  onClick={applyZoomToFitSelection}
                  className="pointer-events-auto shrink-0 p-1.5 rounded border border-dh-strong bg-dh-raised/90 shadow-md hover:bg-dh-hover text-dh-muted hover:text-dh disabled:opacity-35"
                >
                  <Focus size={14} aria-hidden />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="flex w-[200px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-dh-border pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Regions ({regions.length})</p>
            <div className="flex flex-col gap-1.5">
              {regions.map((reg, idx) => {
                const isSel = reg.id === selectedId;
                const r = reg.rect;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(reg.id)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      isSel ? 'border-sky-500/60 bg-sky-950/35 text-dh' : 'border-dh-border bg-dh-raised/50 text-dh-muted hover:bg-dh-hover'
                    }`}
                  >
                    <span className="font-medium text-dh">Region {idx + 1}</span>
                    <div className="font-mono text-[10px] opacity-80">
                      {Math.round(r.x1 - r.x0)}×{Math.round(r.y1 - r.y0)}px
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              tabIndex={0}
              onClick={addFullImageRegion}
              className="inline-flex items-center gap-1 self-stretch justify-center rounded-md border border-dh-border bg-dh-raised/80 px-2 py-1.5 text-[11px] text-dh hover:bg-dh-hover"
            >
              <Plus size={12} /> Add full-image region
            </button>
            <button
              type="button"
              tabIndex={0}
              disabled={!selectedId || regions.length <= 1}
              onClick={removeSelected}
              className="inline-flex items-center gap-1 self-stretch justify-center rounded-md border border-red-900/50 bg-red-950/20 px-2 py-1.5 text-[11px] text-red-300 hover:bg-red-950/40 disabled:opacity-35"
            >
              <Trash2 size={12} /> Remove selected
            </button>
            <div className="mt-auto border-t border-dh-border pt-2">
              <button
                type="button"
                tabIndex={0}
                onClick={onClose}
                className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-dh-border pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Slices · text detection</p>
          <div className="flex max-h-[200px] min-h-[100px] gap-2 overflow-x-auto overflow-y-hidden rounded-md border border-dh-border/60 bg-dh-surface/40 p-2">
            {regions.map((reg, idx) => {
              const inFlight = ocrInFlightIds.has(reg.id);
              const statusLine = reg.ocrComplete
                ? reg.ocrHasText
                  ? 'Text detected in region'
                  : 'No legible text in region'
                : inFlight
                  ? 'Detecting text…'
                  : 'Queued…';
              return (
                <div
                  key={reg.id}
                  className={`flex w-[104px] shrink-0 flex-col gap-1 rounded-md border p-1.5 ${
                    reg.id === selectedId ? 'border-sky-500/50 bg-sky-950/20' : 'border-dh-border/60 bg-dh-raised/30'
                  }`}
                >
                  <div className="relative shrink-0 mx-auto rounded border border-violet-500/40 overflow-hidden">
                    <UnifiedImportSliceThumb layout={layoutForThumb} rect={reg.rect} sizePx={REGION_STRIP_THUMB} />
                    {!reg.ocrComplete && inFlight ? (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 pointer-events-none"
                        aria-busy="true"
                        aria-label="OCR in progress"
                      >
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-white drop-shadow" aria-hidden />
                      </div>
                    ) : null}
                  </div>
                  <span className="text-center text-[10px] font-medium text-dh">Region {idx + 1}</span>
                  <p className="text-center text-[9px] leading-tight text-dh-muted">{statusLine}</p>
                  {importAssetId && updateSlice && allImportSliceRows.length ? (
                    (() => {
                      const row = allImportSliceRows.find((r) => r.assetId === importAssetId && r.regionId === reg.id);
                      if (!row) return null;
                      return (
                        <ImportSliceDestinationControls
                          row={row}
                          allSliceRows={allImportSliceRows}
                          isGameTableGm={isGameTableGm}
                          onAddMapWithImage={onAddMapWithImage}
                          updateSlice={updateSlice}
                          textSliceCollectionOptions={textSliceCollectionOptions}
                          compact
                        />
                      );
                    })()
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </FullPageOverlay>
  );
}
