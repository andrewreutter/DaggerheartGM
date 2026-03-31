import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileImage, Focus, Loader2, Map, Plus, StickyNote, Swords, Trees } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { Tooltip } from '../Tooltip.jsx';
import {
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  computeImageViewportZoomBounds,
  computeZoomAndPanToFitInnerBounds,
} from '../../lib/battle-map-zoom.js';
import {
  clampCropRectToLayout,
  cropLayoutRegionToPngBlob,
  cropLayoutRegionToPngDataUrl,
} from '../../lib/page-layout-load.js';
import { encounterImportSliceSubtitle, inferEncounterImportSuggestions } from '../../lib/encounter-import-slice-ui.js';
import { postPageLayoutRegionOcr } from '../../lib/api.js';

const STRIP_H = 72;
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

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ width: number, height: number, dataUrl: string } | null} props.layout
 * @param {(payload: { dataUrl: string, blob: Blob, cropW: number, cropH: number, ocrText: string, ocrHasText: boolean, ignoreText: boolean }) => void | Promise<void>} [props.onApplyMap]
 * @param {(payload: { dataUrl: string, blob: Blob, cropW: number, cropH: number, ocrText: string, ocrHasText: boolean, ignoreText: boolean }) => void | Promise<void>} [props.onApplyAdversary]
 * @param {(payload: { dataUrl: string, blob: Blob, cropW: number, cropH: number, ocrText: string, ocrHasText: boolean, ignoreText: boolean }) => void | Promise<void>} [props.onApplyEnvironment]
 * @param {(payload: { dataUrl: string, blob: Blob, cropW: number, cropH: number, ocrText: string, ocrHasText: boolean, ignoreText: boolean }) => void | Promise<void>} [props.onApplyNote]
 * @param {string} [props.overlayTitle]
 * @param {string} [props.overlaySubtitle]
 * @param {boolean} [props.hideMap] — hide Map (e.g. library-only import)
 * @param {boolean} [props.hideNote] — hide Note (e.g. library-only import)
 * @param {{ x0: number, y0: number, x1: number, y1: number } | null} [props.initialCropRect] — restore crop after reopening (layout pixel space)
 * @param {boolean} [props.cropOnly] — hide import-type buttons; use {@link onCropOnlyApply} for a single "Apply region" action
 * @param {(payload: object) => void | Promise<void>} [props.onCropOnlyApply]
 * @param {string} [props.zIndexClass] — forwarded to {@link FullPageOverlay} (must sit above Game Table dice/UI layers)
 */
export function PageLayoutPreviewModal({
  open,
  onClose,
  layout,
  onApplyMap,
  onApplyAdversary,
  onApplyEnvironment,
  onApplyNote,
  overlayTitle = 'Encounter image import',
  overlaySubtitle,
  hideMap = false,
  hideNote = false,
  initialCropRect = null,
  cropOnly = false,
  onCropOnlyApply,
  zIndexClass = 'z-[200]',
}) {
  const W = layout?.width ?? 0;
  const H = layout?.height ?? 0;
  const dataUrl = layout?.dataUrl ?? '';

  const [rect, setRect] = useState({ x0: 0, y0: 0, x1: 0, y1: 0 });
  /** Committed crop for OCR only — updated after resize pointer-up, not on every drag frame. */
  const [ocrRect, setOcrRect] = useState({ x0: 0, y0: 0, x1: 0, y1: 0 });
  const [ocrPending, setOcrPending] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrHasText, setOcrHasText] = useState(false);
  const [ignoreText, setIgnoreText] = useState(false);

  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPanLeft, setMapPanLeft] = useState(0);
  const [mapPanTop, setMapPanTop] = useState(0);
  const [rightPanDragging, setRightPanDragging] = useState(false);
  const [hoverCursor, setHoverCursor] = useState('default');

  const viewportRef = useRef(null);
  const rectRef = useRef(rect);
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

  const layoutKey = layout?.dataUrl ?? '';

  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

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
    const full = { x0: 0, y0: 0, x1: W, y1: H };
    const fromSaved = clampCropRectToLayout(initialCropRect, W, H);
    const next = fromSaved || full;
    rectRef.current = next;
    setRect(next);
    setOcrRect(next);
    setOcrText('');
    setOcrHasText(false);
    setIgnoreText(false);
    setHoverCursor('default');
  }, [open, layoutKey, W, H, initialCropRect?.x0, initialCropRect?.y0, initialCropRect?.x1, initialCropRect?.y1]);

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

  useEffect(() => {
    if (!open || !layoutKey || !dataUrl) return;
    let cancelled = false;
    const abortController = new AbortController();
    setOcrPending(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const blob = await cropLayoutRegionToPngBlob(dataUrl, ocrRect.x0, ocrRect.y0, ocrRect.x1, ocrRect.y1);
          const { text, hasText } = await postPageLayoutRegionOcr(blob, { signal: abortController.signal });
          if (cancelled) return;
          const trimmed = String(text || '').trim();
          const legible = !!hasText && trimmed.length > 0;
          setOcrHasText(legible);
          setOcrText(legible ? trimmed : '');
        } catch (e) {
          if (cancelled || e?.name === 'AbortError') return;
          setOcrText('');
          setOcrHasText(false);
        } finally {
          if (!cancelled) setOcrPending(false);
        }
      })();
    }, OCR_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      abortController.abort();
      clearTimeout(t);
      setOcrPending(false);
    };
  }, [open, layoutKey, dataUrl, ocrRect.x0, ocrRect.y0, ocrRect.x1, ocrRect.y1]);

  useEffect(() => {
    if (!ocrHasText) setIgnoreText(false);
  }, [ocrHasText]);

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

  const updateHoverFromClient = useCallback(
    (clientX, clientY) => {
      if (!W || !H) return;
      const { x, y } = clientToWorld(clientX, clientY);
      const h = hitHandle(x, y, rect, mapZoomRef.current);
      if (h) {
        setHoverCursor(HANDLE_CURSORS[h] || 'default');
        return;
      }
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) {
        setHoverCursor('default');
      } else {
        setHoverCursor('default');
      }
    },
    [W, H, rect],
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

  const applyZoomToFitSlice = useCallback(() => {
    const el = viewportRef.current;
    if (!el || W <= 0 || H <= 0) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    const minZ = minZoomRef.current;
    const maxZ = maxZoomRef.current;
    const result = computeZoomAndPanToFitInnerBounds({
      minInnerX: rect.x0,
      minInnerY: rect.y0,
      maxInnerX: rect.x1,
      maxInnerY: rect.y1,
      paddingPx: 12,
      minZoom: minZ,
      maxZoom: maxZ,
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
  }, [rect, W, H]);

  const onPointerDown = (e) => {
    if (!W || !H) return;
    if (e.button !== 0) return;
    const { x, y } = clientToWorld(e.clientX, e.clientY);
    const handle = hitHandle(x, y, rect, mapZoomRef.current);
    if (handle) {
      dragRef.current = {
        type: 'resize',
        handle,
        start: { ...rect },
        startX: x,
        startY: y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) {
      if (!rightPanDraggingRef.current) {
        updateHoverFromClient(e.clientX, e.clientY);
      }
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
      rectRef.current = nr;
      setRect(nr);
      setHoverCursor(HANDLE_CURSORS[d.handle] || 'default');
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
    if (d?.type === 'resize') {
      const r = rectRef.current;
      setOcrRect((prev) =>
        prev.x0 === r.x0 && prev.y0 === r.y0 && prev.x1 === r.x1 && prev.y1 === r.y1 ? prev : { ...r },
      );
    }
    updateHoverFromClient(e.clientX, e.clientY);
  };

  const bw = rect.x1 - rect.x0;
  const bh = rect.y1 - rect.y0;
  const thumbScale = bw > 0 && bh > 0 ? Math.min(260 / bw, STRIP_H / bh) : 1;
  const thumbW = bw * thumbScale;
  const thumbH = bh * thumbScale;

  const buildPayload = useCallback(async () => {
    const dataUrlOut = await cropLayoutRegionToPngDataUrl(dataUrl, rect.x0, rect.y0, rect.x1, rect.y1);
    const blob = await cropLayoutRegionToPngBlob(dataUrl, rect.x0, rect.y0, rect.x1, rect.y1);
    const cropW = Math.max(1, Math.round(bw));
    const cropH = Math.max(1, Math.round(bh));
    return {
      dataUrl: dataUrlOut,
      blob,
      cropW,
      cropH,
      cropRect: { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1 },
      ocrText,
      ocrHasText,
      ignoreText,
    };
  }, [dataUrl, rect, bw, bh, ocrText, ocrHasText, ignoreText]);

  const runApply = useCallback(
    async (fn) => {
      if (!fn || ocrPending) return;
      const payload = await buildPayload();
      await fn(payload);
    },
    [buildPayload, ocrPending],
  );

  const buttonsDisabled = ocrPending;

  const suggestions = useMemo(
    () => inferEncounterImportSuggestions(ocrHasText, ocrText),
    [ocrHasText, ocrText],
  );

  return (
    <FullPageOverlay
      open={open && !!layout}
      onClose={onClose}
      zIndexClass={zIndexClass}
      maxWidthClass="max-w-5xl"
      heightClass="h-[min(92vh,920px)]"
      ariaLabelledBy="page-layout-preview-title"
    >
      <FullPageOverlayHeader
        titleId="page-layout-preview-title"
        title={overlayTitle}
        subtitle={
          overlaySubtitle ||
          (W && H
            ? `${W}×${H}px — wheel pan · Shift+wheel horizontal · ⌘/Ctrl+wheel zoom · right-drag pan · drag handles to resize crop`
            : '')
        }
        icon={FileImage}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
        {W > 0 && H > 0 && dataUrl && (
          <>
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
                      if (!dragRef.current && !rightPanDraggingRef.current) setHoverCursor('default');
                    }}
                  />
                  <div
                    className="pointer-events-none absolute z-[5]"
                    style={{
                      left: `${(rect.x0 / W) * 100}%`,
                      top: `${(rect.y0 / H) * 100}%`,
                      width: `${(bw / W) * 100}%`,
                      height: `${(bh / H) * 100}%`,
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 border-2 border-sky-400 bg-sky-500/15" />
                    {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((name) => {
                      const b = rect;
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
                            left: `${((hx - b.x0) / (b.x1 - b.x0)) * 100}%`,
                            top: `${((hy - b.y0) / (b.y1 - b.y0)) * 100}%`,
                            width: `${(hw / (b.x1 - b.x0)) * 100}%`,
                            height: `${(hw / (b.y1 - b.y0)) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            cursor: HANDLE_CURSORS[name],
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute right-2 bottom-2 z-20">
                <Tooltip label="Zoom to crop">
                  <button
                    type="button"
                    tabIndex={0}
                    aria-label="Zoom to crop"
                    onClick={applyZoomToFitSlice}
                    className="pointer-events-auto shrink-0 p-1.5 rounded border border-dh-strong bg-dh-raised/90 shadow-md hover:bg-dh-hover text-dh-muted hover:text-dh"
                  >
                    <Focus size={14} aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-dh-border pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Slice preview & OCR</p>
              <div className="flex min-h-[88px] gap-3 rounded-md border border-dh-border/60 bg-dh-surface/40 p-2">
                {bw > 0 && bh > 0 ? (
                  <div
                    className="relative shrink-0 overflow-hidden rounded border border-violet-500/50 bg-dh-canvas"
                    style={{
                      width: `${thumbW}px`,
                      height: `${thumbH}px`,
                      backgroundImage: `url(${JSON.stringify(dataUrl)})`,
                      backgroundSize: `${W * thumbScale}px ${H * thumbScale}px`,
                      backgroundPosition: `-${rect.x0 * thumbScale}px -${rect.y0 * thumbScale}px`,
                      backgroundRepeat: 'no-repeat',
                    }}
                  >
                    {ocrPending && (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 pointer-events-none"
                        aria-busy="true"
                        aria-label="OCR in progress"
                      >
                        <Loader2 className="h-7 w-7 shrink-0 animate-spin text-white drop-shadow" aria-hidden />
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="relative min-h-[72px] min-w-0 flex-1 rounded border border-dh-border/50 bg-dh-inset/50 p-2">
                  {ocrPending && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-dh-canvas/60">
                      <Loader2 className="h-6 w-6 animate-spin text-sky-400" aria-hidden />
                    </div>
                  )}
                  {ocrPending ? (
                    <p className="font-mono text-[11px] leading-snug text-dh-muted">…</p>
                  ) : ocrHasText ? (
                    <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-dh">
                      {ocrText}
                    </pre>
                  ) : (
                    <p className="text-xs italic text-dh-muted">No legible text detected</p>
                  )}
                </div>
              </div>
              {ocrHasText && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-dh">
                  <input
                    type="checkbox"
                    checked={ignoreText}
                    onChange={(e) => setIgnoreText(e.target.checked)}
                    className="rounded border-dh-border"
                  />
                  Ignore text
                </label>
              )}

              {cropOnly && onCropOnlyApply ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    tabIndex={0}
                    disabled={buttonsDisabled}
                    onClick={() => void runApply(onCropOnlyApply)}
                    className="rounded-lg border border-sky-600/60 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-45"
                  >
                    Apply region
                  </button>
                </div>
              ) : (
                <div
                  className={`grid grid-cols-2 gap-2 ${
                    [hideMap, hideNote].filter(Boolean).length === 0
                      ? 'sm:grid-cols-4'
                      : [hideMap, hideNote].filter(Boolean).length === 1
                        ? 'sm:grid-cols-3'
                        : 'sm:grid-cols-2'
                  }`}
                >
                  {!hideMap && (
                    <ActionImportButton
                      kind="map"
                      suggested={suggestions.map}
                      icon={Map}
                      label="Map"
                      subtitle={encounterImportSliceSubtitle('map', ocrHasText, ignoreText)}
                      disabled={buttonsDisabled || !onApplyMap}
                      onClick={() => void runApply(onApplyMap)}
                    />
                  )}
                  <ActionImportButton
                    kind="adversary"
                    suggested={suggestions.adversary}
                    icon={Swords}
                    label="Adversary"
                    subtitle={encounterImportSliceSubtitle('adversary', ocrHasText, ignoreText)}
                    disabled={buttonsDisabled || !onApplyAdversary}
                    onClick={() => void runApply(onApplyAdversary)}
                  />
                  <ActionImportButton
                    kind="environment"
                    suggested={suggestions.environment}
                    icon={Trees}
                    label="Environment"
                    subtitle={encounterImportSliceSubtitle('environment', ocrHasText, ignoreText)}
                    disabled={buttonsDisabled || !onApplyEnvironment}
                    onClick={() => void runApply(onApplyEnvironment)}
                  />
                  {!hideNote && (
                    <ActionImportButton
                      kind="note"
                      suggested={suggestions.note}
                      icon={StickyNote}
                      label="Note"
                      subtitle={encounterImportSliceSubtitle('note', ocrHasText, ignoreText)}
                      disabled={buttonsDisabled || !onApplyNote}
                      onClick={() => void runApply(onApplyNote)}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </FullPageOverlay>
  );
}

const SUGGESTED_BTN = {
  map: 'ring-2 ring-sky-400/55 ring-offset-2 ring-offset-dh-canvas border-sky-600/45 bg-sky-950/30',
  adversary: 'ring-2 ring-red-400/50 ring-offset-2 ring-offset-dh-canvas border-red-700/45 bg-red-950/25',
  environment: 'ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-dh-canvas border-emerald-700/45 bg-emerald-950/25',
  note: 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-dh-canvas border-amber-700/45 bg-amber-950/25',
};

function ActionImportButton({ kind, suggested, icon: Icon, label, subtitle, disabled, onClick }) {
  const suggestClass = suggested && kind ? SUGGESTED_BTN[kind] : '';
  return (
    <button
      type="button"
      tabIndex={0}
      disabled={disabled}
      onClick={onClick}
      title={suggested ? 'Suggested for this slice' : undefined}
      data-suggested={suggested ? 'true' : undefined}
      className={`flex flex-col items-stretch gap-0.5 rounded-lg border px-2 py-2 text-left transition-colors hover:bg-dh-hover disabled:cursor-not-allowed disabled:opacity-45 ${
        suggestClass || 'border-dh-border bg-dh-raised/80'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-dh">
        <Plus size={12} className="text-dh-muted shrink-0" aria-hidden />
        <Icon size={14} className={`shrink-0 ${suggested ? 'text-dh' : 'text-dh-muted'}`} aria-hidden />
        {label}
      </span>
      <span className="text-[10px] leading-tight text-dh-muted">{subtitle}</span>
    </button>
  );
}
